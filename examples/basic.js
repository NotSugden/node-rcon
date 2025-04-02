// This minimal example connects and runs the 'help' command.

const RCON = require('../');

const rcon = new RCON('localhost', 25575, 'password');

rcon.on('authenticated', () => {
  // You must wait until this event is fired before sending any commands,
  // otherwise those commands will fail.
  console.log('Authenticated');
  console.log('Sending command: help')
  rcon.send('help');
}).on('response', response => {
  console.log('Response: ' + response);
}).on('error', error => {
  console.error('Error:', error);
}).on('end', () => {
  console.log('Connection closed');
  process.exit(0);
});

rcon.connect();

// connect() will return immediately.
//
// If you try to send a command here, it will fail since the connection isn't
// authenticated yet. Wait for the 'authenticated' event.
