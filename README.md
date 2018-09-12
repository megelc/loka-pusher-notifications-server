# loka-pusher-notifications-server
Loka IoT Pusher Notification server

This small example server subscribes to a particular Loka (https://loka.systems/) Sigfox device and gets events pushed via a websocket.

Specific events will trigger a Pusher Beams (https://pusher.com/beams) push notifications to be sent to subscribers (e.g. an Android App).

The server is implemented using NodeJS.

## Running
> Modify the "config.json" file to include the Loka Device Id's to subscribe to (It's a JSON array)

> docker build -t loka-pusher-notifications-server .

> docker run -e LOKA_AUTH_TOKEN="\<INSERT\>" -e PUSHER_INSTANCE_ID="\<INSERT\>" -e PUSHER_SECRET_KEY="\<INSERT\>" loka-pusher-notifications-server
