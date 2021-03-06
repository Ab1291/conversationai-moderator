/*
Copyright 2019 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { List } from 'immutable';

import {
  IArticleModel,
  ICategoryModel,
  IPreselectModel,
  IRuleModel,
  ITaggingSensitivityModel,
  ITagModel,
  IUserModel,
} from '../../models';
import {
  ArticleModel,
  CategoryModel,
  PreselectModel,
  RuleModel,
  TaggingSensitivityModel,
  TagModel,
  UserModel,
} from '../../models';
import { serviceURL } from './dataService';
import { getToken } from './localStore';

// TODO: Is it possible to nail down the types of this object?
// The WebSocket type is subtly different between browser and non-browser implementation, which makes this difficult.
let myws: any;

if (typeof(WebSocket) === 'undefined') {
  myws = require('ws');
}
else {
  myws = WebSocket;
}

let ws: WebSocket = null;
let intervalTimer: NodeJS.Timer;

export const STATUS_DOWN = 'down';
export const STATUS_UP = 'up';
export const STATUS_RESET = 'reset';

export interface ISystemData {
  users: List<IUserModel>;
  tags: List<ITagModel>;
  taggingSensitivities: List<ITaggingSensitivityModel>;
  rules: List<IRuleModel>;
  preselects: List<IPreselectModel>;
}

export interface IAllArticlesData {
  categories: Array<ICategoryModel>;
  articles: Array<IArticleModel>;
}

export interface IArticleUpdate {
  categories?: Array<ICategoryModel>;
  articles?: Array<IArticleModel>;
}

export interface IPerUserData {
  assignments: number;
}

// TODO: Ideally we'd have a type file describing types sent over the wire.
//       When this is availabe, replace the "any" types in the code below.
function packSystemData(data: any): ISystemData {
  return {
    users: List<IUserModel>(data.users.map((u: any) => {
      return UserModel(u);
    })),
    tags: List<ITagModel>(data.tags.map((t: any) => {
      return TagModel(t);
    })),
    taggingSensitivities: List<ITaggingSensitivityModel>(data.taggingSensitivities.map((t: any) => {
      return TaggingSensitivityModel(t);
    })),
    rules: List<IRuleModel>(data.rules.map((r: any) => {
      return RuleModel(r);
    })),
    preselects: List<IPreselectModel>(data.preselects.map((p: any) => {
      return PreselectModel(p);
    })),
  };
}

function packArticleData(data: any): IAllArticlesData {

  const categories = data.categories.map((c: any) => {
    return CategoryModel(c);
  });

  const articles = data.articles.map((a: any) => {
    return ArticleModel(a);
  });

  return {
    categories: categories,
    articles: articles,
  };
}

function packArticleUpdate(data: any): IArticleUpdate {
  let categories;
  let articles;
  if (data.categories) {
    categories = data.categories.map((c: any) => {
      return CategoryModel(c);
    });
  }

  if (data.articles) {
    articles = data.articles.map((a: any) => {
      return ArticleModel(a);
    });
  }

  return {
    categories: categories,
    articles: articles,
  };
}

let gotSystem = false;
let gotArticles = false;
let gotUser = false;
let socketUp = false;

export function connectNotifier(
  websocketStateHandler: (status: string) => void,
  systemDataHandler: (data: ISystemData) => void,
  allArticlesDataHandler: (data: IAllArticlesData) => void,
  articleUpdateHandler: (data: IArticleUpdate) => void,
  perUserDataHandler: (data: IPerUserData) => void) {
  function checkSocketAlive() {
    if (!ws || ws.readyState !== myws.OPEN) {
      const token = getToken();
      const baseurl = serviceURL(`updates/summary/?token=${token}`);
      const url = baseurl.replace(/^http/, 'ws');

      ws = new myws(url);
      ws.onopen = () => {
        console.log('opened websocket');

        ws.onclose = (e: {code: number}) => {
          console.log('websocket closed', e.code);

          if (e.code === 1005) {
            // Although the meaning of these codes is not clear, it seems that this code means that the server
            // is up and running but rejecting our request, probably due to an authentication issue.
            // We'll need to reset everything and start again.
            websocketStateHandler(STATUS_RESET);
            return;
          }

          socketUp = false;
          if (!gotSystem && !gotArticles && !gotUser) {
            // Never got a message.  Server is rejecting our advances.  Log out and try logging in again.
            websocketStateHandler(STATUS_RESET);
          }
          else {
            websocketStateHandler(STATUS_DOWN);
          }
          ws = null;
        };
      };

      ws.onmessage = (message: {data: string}) => {
        const body: any = JSON.parse(message.data);

        if (body.type === 'system') {
          systemDataHandler(packSystemData(body.data));
          gotSystem = true;
        }
        else if (body.type === 'global') {
          allArticlesDataHandler(packArticleData(body.data));
          gotArticles = true;
        }
        else if (body.type === 'user') {
          perUserDataHandler(body.data as IPerUserData);
          gotUser = true;
        }
        else if (body.type === 'article-update') {
          articleUpdateHandler(packArticleUpdate(body.data));
        }
        if (gotSystem && gotArticles && gotUser && !socketUp) {
          websocketStateHandler(STATUS_UP);
          socketUp = true;
        }
      };
    }
  }

  checkSocketAlive();
  intervalTimer = setInterval(checkSocketAlive, 10000);
}

export function disconnectNotifier() {
  clearInterval(intervalTimer);
  ws.close();
}
