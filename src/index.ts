import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import roomRoutes from "./routes/rooms";
import { setupSocketHandlers } from "./socket/handlers";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({ message: "BlindOrder API running!" });
});

app.use("/room", roomRoutes);
app.use("/rooms", roomRoutes);

// Setup socket handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
