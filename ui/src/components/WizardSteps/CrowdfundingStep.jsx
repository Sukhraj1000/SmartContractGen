import React, { useState, useEffect } from "react";
import { Container, Grid2, Typography, Button, TextField } from "@mui/material";
import { useWizard } from "../../context/WizardContext";

const CrowdfundingStep = () => {
  const { contractSchema, setContractSchema, setCurrentStep } = useWizard();
  const [step, setStep] = useState(1);

  // Reset when contract type is missing
  useEffect(() => {
    if (!contractSchema.contract_type) {
      setCurrentStep(1); // Redirect to contract type selection
    }
  }, [contractSchema, setCurrentStep]);

  // Ensures `contract_name` updates properly
  const handleContractChange = (value) => {
    setContractSchema((prev) => ({
      ...prev,
      contract_name: value || "", // Ensures contract_name is always a string
    }));
  };

  const handleChange = (key, value) => {
    setContractSchema((prev) => ({
      ...prev,
      [key]: value 
    }));
  };

  const handleParameterChange = (key, value) => {
    setContractSchema((prev) => ({
      ...prev,
      parameters: { ...prev.parameters, [key]: value }
    }));
  };

  return (
    <Container maxWidth="sm" sx={{ textAlign: "center", mt: 4 }}>
      {step === 1 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 2: Crowdfunding Details</Typography>
          <TextField 
            fullWidth 
            label="Contract Name" 
            sx={{ mb: 2, backgroundColor: "white" }} 
            value={contractSchema.contract_name || ""}
            onChange={(e) => handleContractChange(e.target.value)}
          />
          <TextField fullWidth type="number" label="Funding Goal" sx={{ mb: 2, backgroundColor: "white" }}
            value={contractSchema.parameters?.funding_goal || ""}
            onChange={(e) => handleParameterChange("funding_goal", e.target.value)} />
          <TextField fullWidth type="date" label="Deadline" sx={{ mb: 3, backgroundColor: "white" }}
            value={contractSchema.parameters?.deadline || ""}
            onChange={(e) => handleParameterChange("deadline", e.target.value)} />
          <Grid2 container justifyContent="space-between">
            <Button variant="outlined" onClick={() => setCurrentStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(2)}
              disabled={!contractSchema.contract_name || !contractSchema.parameters?.funding_goal || !contractSchema.parameters?.deadline}>
              Next
            </Button>
          </Grid2>
        </>
      )}

      {step === 2 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 3: Contributors</Typography>
          <TextField fullWidth label="Contributor Address" sx={{ mb: 2, backgroundColor: "white" }}
            onChange={(e) => handleParameterChange("contributors", [e.target.value])} />
          <Grid2 container justifyContent="space-between" sx={{ width: "100%" }}>
            <Button variant="outlined" onClick={() => setStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setCurrentStep(3)}>
              Next
            </Button>
          </Grid2>
        </>
      )}
    </Container>
  );
};

export default CrowdfundingStep;
