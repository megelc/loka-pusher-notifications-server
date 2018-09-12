'use strict';

// Allow untrusted certs for TLS!
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

const config = require('./config.json');
const https = require("https");
const WebSocketClient = require("websocket").client;
const client = new WebSocketClient();
const PushNotifications = require('@pusher/push-notifications-server');

// Loka Authentication Token
const token = process.env.LOKA_AUTH_TOKEN;

// Pusher instance ID
const pusherInstanceId = process.env.PUSHER_INSTANCE_ID;

// Pusher secret Key
const pusherSecretKey = process.env.PUSHER_SECRET_KEY;

// Create log function
const logger = exports;
logger.debugLevel = 'warn';
logger.log = function(level, message) {
    var levels = ['error', 'warn', 'info'];
    if (levels.indexOf(level) >= levels.indexOf(logger.debugLevel)) {
        if (typeof message !== 'string') {
            message = JSON.stringify(message);
        };
        var d = new Date();
        console.log("\[" + d.toString() + "\]\[" + level + '\] : ' + message);
    }
}

function tryParseJson(str) {
    try {
        return JSON.parse(str);
    } catch (ex) {
        return null;
    }
}

logger.log('info', "Loka Auth Token: " + token + " Pusher instance ID: " + pusherInstanceId + " Pusher secret Key: " + pusherSecretKey);

// Create a Pusher notification object
var pushNotifications = new PushNotifications({
    instanceId: pusherInstanceId,
    secretKey: pusherSecretKey
});

function sendPushNotification(deviceId, message, timestamp) {
    pushNotifications.publish([deviceId], {
        fcm: {
            data: {
                myMessagePayload: message + ': (' + timestamp.toString() + ')\n',
                myDeviceId: deviceId
            }
        }
    }).then((publishResponse) => {
        logger.log('info', 'Just published: ' + publishResponse.publishId + ' to interest: ' + deviceId);
    }).catch((error) => {
        logger.log('error', "Error: " + error.toString());
    });
}

function subscribeDevice(deviceId, token) {
    //Subscribe device
    var optionsget = {
        host: "core.loka.systems",
        port: 443,
        path: "/subscribe_terminal/" + deviceId,
        method: "GET",
        headers: {
            Authorization: "Bearer " + token
        }
    };

    // Do the HTTP GET request
    var reqGet = https.request(optionsget, function(res) {
        logger.log('info', "HTTP GET request statusCode: " + res.statusCode);
        res.on("data", function(d) {
            logger.log('info', "HTTP GET data: " + d);
        });
    });

    reqGet.end();
    reqGet.on("error", function(e) {
        logger.log('error', "HTTP GET Error: " + e.toString());
    });
}

function unsubscribeDevice(deviceId, token) {
    //Unsubscribe device
    var optionsget = {
        host: "core.loka.systems",
        port: 443,
        path: "/unsubscribe_terminal/" + deviceId,
        method: "GET",
        headers: {
            Authorization: "Bearer " + token
        }
    };

    // Do the HTTP GET request
    var reqGet = https.request(optionsget, function(res) {
        logger.log('info', "HTTP GET request statusCode: " + res.statusCode);
    });
    reqGet.end();
    reqGet.on("error", function(e) {
        logger.log('error', "HTTP GET Error: " + e.toString());
    });
}


logger.log('info', "Subscribing devices...");
for (var deviceId in config.devices) {
    logger.log('info', 'Subscribing: ' + config.devices[deviceId]);
    subscribeDevice(config.devices[deviceId], token);
}

client.on("connectFailed", function(error) {
    logger.log('error', "Connect Error: " + error.toString());
});

client.on("connect", function(connection) {
    logger.log('info', 'WebSocket Client Connected.');

    // Send a push notification that the server has started
    var d = new Date();
    sendPushNotification('Server', 'Server started', d);

    connection.on("error", function(error) {
        logger.log('error', "Connection Error: " + error.toString());
    });

    connection.on("close", function() {
        logger.log('info', "Connection Closed");
    });

    connection.on("message", function(message) {
        if (message.type === "utf8") {
            logger.log('info', "Received: '" + message.utf8Data + "'");

            var payload = tryParseJson(message.utf8Data);

            // Check the payload and send a push notification if needed
            // Note: Below is very application specific code, related to a Loka IOT device
            if (payload && payload.hasOwnProperty('gpio') &&
                payload.gpio.hasOwnProperty('port') &&
                payload.gpio.port == "101" &&
                payload.gpio.hasOwnProperty('value') &&
                payload.gpio.value == true) {

                var d = new Date(payload.timestamp * 1000);
                sendPushNotification(String(payload.src), 'Movement detected', d);
            }
        }
    });
});

client.connect(
    "wss://core.loka.systems/messages",
    null,
    null, {
        Authorization: "Bearer " + token
    },
    null
);

//Unsubscribe device when terminating
process.on("SIGINT", function() {
    logger.log('info', "Unsubscribing devices...");
    for (var deviceId in config.devices) {
        logger.log('info', 'Unsubscribing: ' + config.devices[deviceId]);
        unsubscribeDevice(config.devices[deviceId], token);
    }
});
