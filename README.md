OSMod - The ConversationAI Moderator App
========================================

Deploying an OSMod instance
---------------------------

### Configuration

The configuration is found in packages/config/index.js.  It is pretty self explanatory.
All settings can be overridden via environment variables.

Of particular note, the following have no sensible defaults, and
must be set in the enviromnent before anything will work.

* `DATABASE_NAME`: The MySQL database name, e.g., 'os_moderator'.
* `DATABASE_USER`: The MySQL database user, e.g., 'os_moderator'.
* `DATABASE_PASSWORD`: The MySQL database password.
* `GOOGLE_CLIENT_ID`: Google OAuth API client id.
* `GOOGLE_CLIENT_SECRET`:  Google OAuth API secret.
* `GOOGLE_SCORE_AUTH`: An authentication key for The Perspective API proxy (see below).

To get values for the latter two items, create an OAuth2.0 Client ID
entry for your app in the [Google API console](https://console.developers.google.com/apis/credentials).
Set the Authorised redirect URI to `http://localhost:8080/auth/callback/google`.
(Replace localhost with the address of your server if you are not running
locally.)

In a production setting, you'll also have to set the following:

* `API_URL`: URL for the API endpoint
* `FRONTEND_URL`: URL for the Frontend endpoint
* `TOKEN_SECRET`: A secret used to generate authentication tokens.

### System setup:

Install mysql, node, npm and redis.  Instructions for Ubuntu:

```bash
sudo apt install mysql-server nodejs npm redis
sudo npm install -g npm

# On older versions of ubuntu, you can use `n` to ensure you get the correct version
# of node.js installed.
sudo npm install -g n
sudo n stable
hash -r
```

#### System setup -- Docker

If you want to run your moderator instances in one of the preconfigured docker containers,
you'll need to install docker.  E.g., to install on Ubuntu 18.04 using apt

```bash
sudo apt install docker.io

# Add docker group to your account so you can talk to the local docker server.
# You probably need to log out and back in for groups to take effect.
sudo usermod -a -G docker `whoami`

sudo curl -L https://github.com/docker/compose/releases/download/1.21.2/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# check things work
docker version
docker-compose --version.
```

### Install dependencies and run the server

Install all node dependencies and run initial typescript compile.

```bash
./bin/install
```

Setup local MySQL:

```bash
mysql -u root -p << EOF
CREATE DATABASE $DATABASE_NAME;
CREATE USER '$DATABASE_USER' IDENTIFIED BY '$DATABASE_PASSWORD';
GRANT ALL on $DATABASE_NAME.* to $DATABASE_USER;
EOF

mysql -u root -p $DATABASE_NAME < packages/backend-core/seed/initial-database.sql
./bin/osmod migrate
```

See [the SQL Data Model docs](docs/modeling.md) for more info.

You'll also need to create some (human) users.  The email address of the new users
should match the Google account address used to log in.  See below for instructions
on how to do this via the commandline.

#### Run in a docker container

To run the service in a local docker container, run the following commands:

```bash
# Make sure any local instances of MySQL and Redis are not running
# E.g., on Ubuntu, stop the services
sudo systemctl stop mysql.service redis_6379.service redis-server.service

# Create docker images and launch the service
docker-compose -f deployments/local/docker-compose.yml up -d

# Initialise the database
mysql -u $DATABASE_USER -p -h 127.0.0.1 $DATABASE_NAME < packages/backend-core/seed/initial-database.sql
./bin/osmod migrate
```

To shut down the service and delete all your containers:

```bash
docker-compose -f deployments/local/docker-compose.yml down
```

And to see what the container is doing:

```bash
docker-compose -f deployments/local/docker-compose.yml logs
```

#### Adding users

To actually do anyting, you'll need to create some users.  You'll need at least

* a human user so you can log in and view comments

* a service user that knows how to talk to a PerpectiveAPI proxy server.

Add human users with the following command:

```bash
./bin/osmod users:create --group general --name "Name" --email "email@gmail.com"
```

Human users get authenticated using Google's OAuth server, so the email address must
correspond to a google account.

Add the proxy service user with the following command:

```bash
./bin/osmod users:create --group service --name "PerspectiveProxy" --endpoint=<proxy URL>
```

where `<proxy URL>` is the URL of [The Perspective API proxy] you plan on using.

### The Perspective API proxy

OSMod is designed to talk to the Perspective API via a proxy server: the
[Perspective API proxy](https://github.com/conversationai/perspectiveapi-proxy).

There is a preconfigured proxy server set up for general use.
The URL of this proxy is [https://osmod-assistant.appspot.com/].  To access it,
you'll need to get a suitable authentication token from
[the Perspective API team](https://www.perspectiveapi.com/#/).  In this case you
need to set your service user's proxy URL to
`https://osmod-assistant.appspot.com/api/score-comment`.

Alternatively, if you have been given direct access to the Perspecitve API, you
can create a Perspective API key in a Google Cloud project and then run
a local instance of the proxy as described in the
[Perspective API proxy documentation](https://github.com/conversationai/perspectiveapi-proxy/blob/master/README.md).
E.g.:

```bash
export GOOGLE_CLOUD_API_KEY=<API Key>
export AUTH_WHITELIST=$GOOGLE_SCORE_AUTH
export ATTRIBUTE_REQUESTS
read -r -d '' ATTRIBUTE_REQUESTS << EOM
{
  "ATTACK_ON_AUTHOR": {},
  "ATTACK_ON_COMMENTER": {},
  "INCOHERENT": {},
  "INFLAMMATORY": {},
  "OBSCENE": {},
  "OFF_TOPIC": {},
  "SPAM": {} ,
  "UNSUBSTANTIAL": {},
  "LIKELY_TO_REJECT": {},
  "TOXICITY": {},
  "TOXICITY_FAST": {}
}
EOM

cd $PERSPECTIVEAPI_PROXY_LOCATION
yarn install
PORT=8081 ATTRIBUTE_REQUESTS='{ "TOXICITY": {} }' yarn run watch
```

TODO: Need fixes to proxy and osmod:
ATTACK_ON_PUBLISHER is in proxy's default list and osmod UI, but doesn't work.
SUMMARY_SCORE in osmod UI, but doesn't work.
Fix osmod by removing entries from initial sql.  Need a better way of doing initial
SQL too.

Then use `http://localhost:8081/api/score-comment` as the proxy URL when creating
your service user.

The `osmod` CLI
---------------

You can manage your OSMod system using the osmod commandline tool:

```bash
./bin/osmod <command> <options>
```

where `command` is one of

* `migrate`                          Migrate the database up
* `migrate:undo`                     Reverse a database migration
* `users:create`                     Create new OS Moderator users
* `users:get-token`                  Get a JWT token for a user specified by id or email
* `denormalize`                      Re-run denormalize counts
* `exec`                             Run a subcommand with app.yaml environment
* `comments:recalculate-text-sizes`  Using node-canvas, recalculate comment heights at a given width.
* `comments:calculate-text-size`     Using node-canvas, calculate a single comment height at a given width.
* `comments:recalculate-top-scores`  Recalculate comment top scores.
* `comments:rescore`                 Rescore comment.

#### Managing Users

Create a human user:

```bash
./bin/osmod users:create --group general --name "Name" --email "email@example.com"
```

Create a service user:

```bash
./bin/osmod users:create --group service --name "Robot"
```

Get a JWT token for an existing user:

* By user id:

```bash
./bin/osmod users:get-token --id 4
```

* By email:

```bash
./bin/osmod users:get-token --email "email@example.com"
```


OSMod Tools
-----------

### Management commands

To run a local server on `:8080` and front-end on `:8000`

```bash
./bin/watch
```

### Publish

Uses Lerna to publish to the different npm packages

```bash
./bin/publish
```

### Lint

```bash
./bin/lint
```

optionally you can run lint-fix to attempt auto-fixing most lint errors

```bash
./bin/lint-fix
```

### Storybook

Diffs storyshots of the current code against the last saved.

```bash
./bin/storybook
```

To update stories that need new snapshots, go to `packages/frontend-web` and run

```bash
npm run storybook:test -- -u
```

## Development

The project uses [lerna](https://www.npmjs.com/package/lerna) to help manage
development [the several npm packages](packages/README.md) that are in this
repository. Lerna sym-links package dependencies within this repository. Lerna
is also used to publish updates to all these packages at once.

## Running tests

To run the tests, you'll need to tweak your enviornment:

```bash
# Some tests need admin privileges to clean out the database
export DATABASE_NAME=os_moderator_test
export DATABASE_USER=root

# Run all the tests
NODE_ENV=test bin/test

# or you can run individual tests:
cd packages/backend-core
NODE_ENV=test npm run test
NODE_ENV=test ../../node_modules/.bin/mocha 'dist/test/domain/comments/*.spec.js' --recursive --timeout 10000
```

The `bin/test` script uses lerna to first compile all the typescript to javascript,
then runs all the tests.

Deleting and recreating the database schema can take a very long time, hence the long timeout above.
You may need to increase this even further if your system is particularly slow.

If you want to run a test in the debugger, add the --inspect-brk flag to the mocha invocation,
then connect using the chrome inspector (URL: `chrome://inspect`).

## What a running service looks like

While there can be many ways to setup a service, in general a deployment will
typically be a single VM instance running these services:

A MySQL database that holds all of the applications state (See
[the data model doc](docs/modelling.md)).

*  Frontend-Webserver service hosting the static ReactJS site. This sends
   messages to the Backend API service.
*  Backend API service responsible for querying the SQL database and sending
   data to the front-end service. This is also the endpoint that receives
   requests from the commenting platform it is supporting moderation of; and
   it sends requests back to the commenting platform with user actions (e.g. to
   reject or approve comments).
*  Backend Work Queue service responsible for managing concurrent queue of
   asynchronous work. TODO(ldixon): add reddis stuff?
*  Some number of assistant services responsible for automating tasks.
   Typically this is just calling ML services like
   [the Perspective API](https://perspectiveapi.com/)

