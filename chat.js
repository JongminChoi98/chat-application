const net = require("net");
const readline = require("readline");
const os = require("os");

const listeningPort = process.argv[2];
if (!listeningPort) {
  console.log("Usage: node chat.js <listening_port>");
  process.exit(1);
}

let connections = [];
let nextId = 1;

function getMyIP() {
  const interfaces = os.networkInterfaces();
  for (let iface in interfaces) {
    for (let i = 0; i < interfaces[iface].length; i++) {
      let alias = interfaces[iface][i];
      if (alias.family === "IPv4" && !alias.internal) {
        return alias.address;
      }
    }
  }
  return "127.0.0.1";
}

const server = net.createServer((socket) => {
  socket.setEncoding("utf8");
  const remoteAddress = socket.remoteAddress;
  const remotePort = socket.remotePort;
  const connection = {
    id: nextId++,
    socket: socket,
    remoteAddress: remoteAddress,
    remotePort: remotePort,
  };
  connections.push(connection);
  console.log(
    `New connection accepted: [ID: ${connection.id}] ${remoteAddress}:${remotePort}`
  );
  socket.on("data", (data) => {
    data = data.trim();
    console.log(
      `\n[Message received] ${remoteAddress}:${remotePort}\nMessage: ${data}`
    );
    rl.prompt();
  });
  socket.on("close", () => {
    console.log(
      `Connection closed: [ID: ${connection.id}] ${remoteAddress}:${remotePort}`
    );
    connections = connections.filter((conn) => conn.id !== connection.id);
    rl.prompt();
  });
  socket.on("error", (err) => {
    console.log(`Error: ${err.message}`);
  });
});

server.listen(listeningPort, () => {
  console.log(`Server listening on port ${listeningPort}`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ">> ",
});

function printHelp() {
  console.log("Available commands:");
  console.log("help                         - show available commands");
  console.log("myip                         - display current IP address");
  console.log("myport                       - display listening port number");
  console.log(
    "connect <destination> <port> - connect to specified IP and port"
  );
  console.log("list                         - display all active connections");
  console.log(
    "terminate <connection id>    - terminate a specified connection"
  );
  console.log(
    "send <connection id> <msg>   - send a message (max 100 characters) to a specified connection"
  );
  console.log(
    "exit                         - terminate all connections and exit the program"
  );
}

function connectToPeer(destIP, destPort) {
  if (destPort == listeningPort && destIP === getMyIP()) {
    console.log("Error: Cannot connect to self.");
    return;
  }
  for (let conn of connections) {
    if (conn.remoteAddress === destIP && conn.remotePort == destPort) {
      console.log("Error: Connection already exists.");
      return;
    }
  }
  const client = new net.Socket();
  client.setEncoding("utf8");
  client.connect(destPort, destIP, () => {
    const connection = {
      id: nextId++,
      socket: client,
      remoteAddress: destIP,
      remotePort: destPort,
    };
    connections.push(connection);
    console.log(
      `Connection established: [ID: ${connection.id}] ${destIP}:${destPort}`
    );
    rl.prompt();
  });
  client.on("data", (data) => {
    data = data.trim();
    console.log(`\n[Message received] ${destIP}:${destPort}\nMessage: ${data}`);
    rl.prompt();
  });
  client.on("close", () => {
    console.log(`Connection closed: ${destIP}:${destPort}`);
    connections = connections.filter((conn) => conn.socket !== client);
    rl.prompt();
  });
  client.on("error", (err) => {
    console.log(`Connection error: ${err.message}`);
    rl.prompt();
  });
}

function listConnections() {
  if (connections.length === 0) {
    console.log("No active connections.");
    return;
  }
  console.log("ID\tIP Address\tPort");
  connections.forEach((conn) => {
    console.log(`${conn.id}\t${conn.remoteAddress}\t${conn.remotePort}`);
  });
}

function terminateConnection(id) {
  const conn = connections.find((c) => c.id == id);
  if (!conn) {
    console.log(`Error: No connection found with ID ${id}.`);
    return;
  }
  conn.socket.end();
  console.log(`Connection [ID: ${id}] termination requested.`);
}

function sendMessage(id, message) {
  if (message.length > 100) {
    console.log("Error: Message can be at most 100 characters.");
    return;
  }
  const conn = connections.find((c) => c.id == id);
  if (!conn) {
    console.log(`Error: No connection found with ID ${id}.`);
    return;
  }
  conn.socket.write(message);
  console.log(`Message sent: [ID: ${id}]`);
}

function exitProgram() {
  connections.forEach((conn) => {
    conn.socket.end();
  });
  server.close();
  console.log("Program terminated.");
  process.exit(0);
}

rl.prompt();
rl.on("line", (line) => {
  let args = line.trim().split(" ");
  let command = args[0];
  switch (command) {
    case "help":
      printHelp();
      break;
    case "myip":
      console.log(`My IP Address: ${getMyIP()}`);
      break;
    case "myport":
      console.log(`My Port: ${listeningPort}`);
      break;
    case "connect":
      if (args.length < 3) {
        console.log("Usage: connect <destination> <port>");
      } else {
        let destIP = args[1];
        let destPort = args[2];
        connectToPeer(destIP, destPort);
      }
      break;
    case "list":
      listConnections();
      break;
    case "terminate":
      if (args.length < 2) {
        console.log("Usage: terminate <connection id>");
      } else {
        terminateConnection(args[1]);
      }
      break;
    case "send":
      if (args.length < 3) {
        console.log("Usage: send <connection id> <message>");
      } else {
        let id = args[1];
        let message = args.slice(2).join(" ");
        sendMessage(id, message);
      }
      break;
    case "exit":
      exitProgram();
      break;
    default:
      console.log("Unknown command. Type 'help' to see available commands.");
  }
  rl.prompt();
}).on("close", () => {
  exitProgram();
});
