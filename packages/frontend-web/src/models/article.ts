/*
Copyright 2017 Google Inc.

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

import { ModelId } from './common';

export interface IArticleAttributes {
  id: ModelId;
  sourceCreatedAt: string;
  updatedAt: string;
  title: string;
  text: string;
  url: string;
  categoryId: ModelId;
  allCount: number;
  unprocessedCount: number;
  unmoderatedCount: number;
  moderatedCount: number;
  deferredCount: number;
  approvedCount: number;
  highlightedCount: number;
  rejectedCount: number;
  flaggedCount: number;
  batchedCount: number;
  automatedCount: number;
  lastModeratedAt: string;
  assignedModerators: Array<ModelId>;
  isCommentingEnabled: boolean;
  isAutoModerated: boolean;
}

export type IArticleModel = Readonly<IArticleAttributes>;

export function ArticleModel(articleData?: IArticleAttributes): IArticleModel {
  // Sanitize URLs for security.
  if (articleData.url) {
    const url = articleData.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      articleData.url = null;
    }
  }
  return articleData as IArticleModel;
}
