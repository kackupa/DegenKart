import { createServer } from "node:http";
import { Server } from "socket.io";

const port = process.env.PORT || 10000;
const bots = [
  { id: "vlad", name: "VLAD", color: "#a879ff", lap: 2, progress: 71 },
  { id: "cz", name: "CZ", color: "#ffd43b", lap: 2, progress: 61 },
  { id: "elon", name: "ELON", color: "#46e5ff", lap: 2, progress: 54 },
];
const racers = new Map(bots.map((racer) => [racer.id, racer]));
const httpServer = createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ status: "ok", race: "neon-circuit", racers: racers.size }));
});
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });
const snapshot = () => ({ racers: [...racers.values()], spectators: io.sockets.sockets.size + 128 });

io.on("connection", (socket) => {
  socket.emit("race:state", snapshot());
  socket.on("racer:join", ({ name = "RACER", color = "#ff4fd8" } = {}) => {
    const racer = { id: socket.id, name: String(name).slice(0, 12).toUpperCase(), color, lap: 1, progress: 0 };
    racers.set(socket.id, racer);
    socket.emit("racer:you", racer);
    io.emit("race:state", snapshot());
  });
  socket.on("racer:input", ({ boost = false } = {}) => {
    const racer = racers.get(socket.id); if (!racer) return;
    racer.progress += boost ? 6 : 1;
    if (racer.progress >= 100) { racer.progress -= 100; racer.lap += 1; }
    io.emit("race:state", snapshot());
  });
  socket.on("disconnect", () => { racers.delete(socket.id); io.emit("race:state", snapshot()); });
});
setInterval(() => { for (const racer of bots) racer.progress = (racer.progress + 0.7) % 100; io.emit("race:state", snapshot()); }, 300);
httpServer.listen(port, () => console.log(`Degen Kart race server listening on ${port}`));
