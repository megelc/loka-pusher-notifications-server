'use strict';

// Allow untrusted certs for TLS!
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

var https = require("https");
var WebSocketClient = require("websocket").client;
var client = new WebSocketClient();
var PushNotifications = require('@pusher/push-notifications-server');

// Loka Authentication Token
var token = process.env.LOKA_AUTH_TOKEN;

// Loka Device ID
var deviceId = process.env.LOKA_DEVICE_ID;

// Pusher instance ID
var pusherInstanceId = process.env.PUSHER_INSTANCE_ID;

// Pusher secret Key
var pusherSecretKey = process.env.PUSHER_SECRET_KEY;

// Create log function
var logger = exports;
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

logger.log('info', "Loka Auth Token: " + token + " Loka Device ID: " + deviceId + " Pusher instance ID:" + pusherInstanceId + " Pusher secret Key:" + pusherSecretKey);

// Create a Pusher notification object
var pushNotifications = new PushNotifications({
    instanceId: pusherInstanceId,
    secretKey: pusherSecretKey
});

function sendPushNotification(message, timestamp) {
    pushNotifications.publish(['hello'], {
        fcm: {
            data: {
                myMessagePayload: message + ': (' + timestamp.toString() + ')\n',
                isMyPushNotification: true
            }
        }
    }).then((publishResponse) => {
        logger.log('info', 'Just published: ' + publishResponse.publishId);
    }).catch((error) => {
        logger.log('error', "Error: " + error.toString());
    });
}

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

client.on("connectFailed", function(error) {
    logger.log('error', "Connect Error: " + error.toString());
});

client.on("connect", function(connection) {
    logger.log('info', 'WebSocket Client Connected.');

    // Send a push notification that the server has started
    var d = new Date();
    sendPushNotification('Server started [' + deviceId + ']', d);

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
                sendPushNotification('Movement detected', d);
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
    logger.log('info', "Unsubscribing device...");

    optionsget.path = "/unsubscribe_terminal/" + deviceId;
    var reqGet = https.request(optionsget, function(res) {
        logger.log('info', "Done!");
        process.exit();
    });
    reqGet.end();
});
