import React, { useState, useEffect } from "react";
import { Container, Grid2, Typography, Button, TextField, Paper } from "@mui/material";
import { useWizard } from "../../context/WizardContext";

const TokenVestingStep = () => {
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


  const handleChange = (category, key, value) => {
    setContractSchema((prev) => ({
      ...prev,
      [category]: { ...prev[category], [key]: value }
    }));
  };

  return (
    <Container maxWidth="sm" sx={{ textAlign: "center", mt: 4 }}>
      {step === 1 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 2: Token Vesting Details</Typography>
          <TextField 
            fullWidth 
            label="Contract Name" 
            sx={{ mb: 2, backgroundColor: "white" }} 
            value={contractSchema.contract_name || ""}
            onChange={(e) => handleContractChange(e.target.value)}
          />
          <TextField fullWidth label="Beneficiary Wallet" sx={{ mb: 2, backgroundColor: "white" }}
            value={contractSchema.parameters?.beneficiary || ""}
            onChange={(e) => handleChange("parameters", "beneficiary", e.target.value)}
          />
          <TextField fullWidth type="number" label="Total Tokens" sx={{ mb: 3, backgroundColor: "white" }}
            value={contractSchema.parameters?.total_tokens || ""}
            onChange={(e) => handleChange("parameters", "total_tokens", e.target.value)}
          />
          <Grid2 container justifyContent="space-between">
            <Button variant="outlined" onClick={() => setCurrentStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(2)}
              disabled={!contractSchema.contract_name || !contractSchema.parameters?.beneficiary || !contractSchema.parameters?.total_tokens}>
              Next
            </Button>
          </Grid2>
        </>
      )}

      {step === 2 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 3: Vesting Schedule</Typography>
          <TextField fullWidth type="number" label="Vesting Period (Months)" sx={{ mb: 2, backgroundColor: "white" }}
            value={contractSchema.parameters?.vesting_period || ""}
            onChange={(e) => handleChange("parameters", "vesting_period", e.target.value)}
          />
          <TextField fullWidth type="number" label="Cliff Period (Months)" sx={{ mb: 3, backgroundColor: "white" }}
            value={contractSchema.parameters?.cliff_period || ""}
            onChange={(e) => handleChange("parameters", "cliff_period", e.target.value)}
          />
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

export default TokenVestingStep;
