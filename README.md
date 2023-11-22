# HK transport backend

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

The Backend for hk-transport. It will scrape data from various api periodically and serve the files for the front-end.

-   [Live instance](https://api.12a.app/hk-transport)

## Installing

1.  Clone the git repository

    `https://github.com/angus6b23/hk-transport-backend.git`

2.  Edit config.yaml. Please see the comment and consult relevant documentations.

3.  Start the server

    Using npm

    `npm run start`

    Using yarn

    `yarn run start`

4.  Please wait for about 5 minutes for server to fetch required data.

5.  Setup systemd and nginx (optional, See below)

## Setup nginx

Example configuration is avaliable, see nginx-example.conf. To copy to nginx config folder:

```
sudo cp nginx-example.conf /etc/nginx/sites-avaliable/hk-transport-backend.conf
```

Replace the server_name in the config

```
sudo sed -i 's/your.domain.tld/REPLACEME' /etc/nginx/sites-avaliable/hk-transport-backend.conf
```

Enable the config by creating a symbolic link

```
sudo ln -s /etc/nginx/sites-avaliable/hk-transport-backend.conf /etc/nginx/sites-enabled/hk-transport-backend.conf
```

Test the config file

```
sudo nginx -t
```

If no error is detected, restart nginx to make changes

```
sudo systemctl restart nginx.service
```

Consider use certbot to setup TLS

```
sudo certbot --nginx
```

Select your domain and the plugin will do the rest for you.

## Systemd setup

Example configuration is avaliable, see systemd-example.service. To copy to systemd folder:

```
sudo cp systemd-example.service /etc/systemd/user/hk-transport-backend.service
```

Use your favourite editor to change the working path and the binary of npx or yarn. To get the full path of npx or yarn, use

```
which npx
which yarn
```

Reload systemd to get the service unit scanned

```
sudo systemctl daemon-reload
```

Start the service

```
sudo systemctl start hk-transport-backend
```

If you want the service get started at startup

```
sudo systemctl enable hk-transport-backend
```
