import {createRoot} from "react-dom/client";
import RaceGame from "../app/game/RaceGame";
import MultiplayerGame from "../app/game/MultiplayerGame";
import {RACE_SERVER_URL} from "../app/game/server-address";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(RACE_SERVER_URL?<MultiplayerGame url={RACE_SERVER_URL}/>:<RaceGame/>);
