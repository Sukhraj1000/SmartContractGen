import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import WizardSteps from "./pages/WizardSteps";
import FileUpload from "./components/FileUpload";
import { WizardProvider } from "./context/WizardContext";
import { CssBaseline, Container } from "@mui/material";

function App() {
  return (
    <WizardProvider>
      <CssBaseline />
      <Router>
        <Container>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/wizard" element={<WizardSteps />} />
            <Route path="/upload" element={<FileUpload />} />
          </Routes>
        </Container>
      </Router>
    </WizardProvider>
  );
}

export default App;
