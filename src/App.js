import { Routes, Route } from "react-router-dom";
import StorePage from "./pages/StorePage";

function App() {
  return (
    <Routes>
      <Route path="/store/:slug" element={<StorePage />} />
    </Routes>
  );
}

export default App;