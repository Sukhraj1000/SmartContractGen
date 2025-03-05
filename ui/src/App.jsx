import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import WizardSteps from "./pages/WizardSteps";
import FileUpload from "./components/FileUpload";
import ReviewStep from "./components/WizardSteps/ReviewStep";
import ContractOutput from "./pages/ContractOutput";
<<<<<<< HEAD
=======
import ContractProcessing from "./pages/ContractProcessing";
>>>>>>> 016c6a8 (generated keys and addresses with output of smart contracts)
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
<<<<<<< HEAD
=======
            <Route path="/processing/:contractId" element={<ContractProcessing />} />
>>>>>>> 016c6a8 (generated keys and addresses with output of smart contracts)
          </Routes>
        </Container>
      </Router>
    </WizardProvider>
  );
}

export default App;
