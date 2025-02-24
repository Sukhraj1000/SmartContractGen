import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import WizardSteps from "./pages/WizardSteps";
import FileUpload from "./components/FileUpload";
import ReviewStep from "./components/WizardSteps/ReviewStep";
import ContractOutput from "./pages/ContractOutput";
import { WizardProvider } from "./context/WizardContext";
import { CssBaseline, Container } from "@mui/material";

function App() {
  return (
    <WizardProvider>
      <CssBaseline />
      <Router>
        <Container sx={{ mt: 4 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/wizard" element={<WizardSteps />} />
            <Route path="/upload" element={<FileUpload />} />
            <Route path="/review" element={<ReviewStep />} />
            <Route path="/contract/:contractId" element={<ContractOutput />} />
          </Routes>
        </Container>
      </Router>
    </WizardProvider>
  );
}

export default App;
