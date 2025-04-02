// This example reads commands from stdin and sends them on enter key press.

const RCON = require('../');

const rcon = new RCON('localhost', 1234, 'password');

rcon.on('authenticated', () => {
  console.log('Authenticated');

  process.stdin.on('data', inputBuffer => {
    // Convert buffer to string and take out last 2 characters- return character.
    const inputString = inputBuffer.toString().slice(0, -2);

    if (inputString === 'disconnect') {
      console.log('Disconnecting from the server');
      return rcon.disconnect();
    }

    rcon.send(inputString);
  });

}).on('response', response => {
  console.log('Response: ' + response);
}).on('error', error => {
  console.error('Error:', error);
}).on('end', () => {
  console.log('Connection closed');
  process.exit(0);
});

rcon.connect();
