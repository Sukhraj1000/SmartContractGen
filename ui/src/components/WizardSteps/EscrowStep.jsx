import React, { useState, useEffect } from "react";
import { Container, Grid2, Typography, Button, TextField, Select, MenuItem } from "@mui/material";
import { useWizard } from "../../context/WizardContext";

const EscrowStep = () => {
  const { contractSchema, setContractSchema, setCurrentStep } = useWizard();
  const [step, setStep] = useState(1);

  // Reset if contract type is missing
  useEffect(() => {
    if (!contractSchema.contract_type) {
      setCurrentStep(1);
    }
  }, [contractSchema.contract_type, setCurrentStep]);

  // Ensures `contract_name` updates properly
  const handleContractChange = (value) => {
    setContractSchema((prev) => ({
      ...prev,
      contract_name: value || "", 
    }));
  };

  const handleChange = (category, key, value) => {
    setContractSchema((prev) => ({
      ...prev,
      [category]: {
        ...prev[category], 
        [key]: value,
      },
    }));
  };

  return (
    <Container maxWidth="sm" sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 4 }}>
      {step === 1 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 2: Escrow Details</Typography>
          <TextField 
            fullWidth 
            label="Contract Name" 
            sx={{ mb: 2, backgroundColor: "white" }} 
            value={contractSchema.contract_name || ""}
            onChange={(e) => handleContractChange(e.target.value)}
          />
          <TextField 
            fullWidth 
            label="Buyer Wallet Address" 
            sx={{ mb: 2, backgroundColor: "white" }}
            value={contractSchema.parties?.buyer || ""}
            onChange={(e) => handleChange("parties", "buyer", e.target.value)}
          />
          <TextField 
            fullWidth 
            label="Seller Wallet Address" 
            sx={{ mb: 3, backgroundColor: "white" }}
            value={contractSchema.parties?.seller || ""}
            onChange={(e) => handleChange("parties", "seller", e.target.value)}
          />
          <Grid2 container justifyContent="space-between" sx={{ width: "100%" }}>
            <Button variant="outlined" onClick={() => setCurrentStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(2)}
              disabled={!contractSchema.contract_name || !contractSchema.parties?.buyer || !contractSchema.parties?.seller}>
              Next
            </Button>
          </Grid2>
        </>
      )}

      {step === 2 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 3: Define Escrow Terms</Typography>
          <TextField 
            fullWidth 
            type="number" 
            label="Escrow Amount" 
            sx={{ mb: 2, backgroundColor: "white" }}
            value={contractSchema.parameters?.amount || ""}
            onChange={(e) => handleChange("parameters", "amount", e.target.value)}
          />
          <Select 
            fullWidth 
            value={contractSchema.parameters?.currency || "SOL"} 
            sx={{ backgroundColor: "white", mb: 2 }}
            onChange={(e) => handleChange("parameters", "currency", e.target.value)}
          >
            <MenuItem value="SOL">Solana (SOL)</MenuItem>
            <MenuItem value="USDC">USD Coin (USDC)</MenuItem>
          </Select>
          <TextField 
            fullWidth 
            label="Release Condition" 
            sx={{ mb: 3, backgroundColor: "white" }}
            value={contractSchema.parameters?.release_condition || ""}
            onChange={(e) => handleChange("parameters", "release_condition", e.target.value)}
          />
          <Grid2 container justifyContent="space-between" sx={{ width: "100%" }}>
            <Button variant="outlined" onClick={() => setStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setCurrentStep(3)}
              disabled={!contractSchema.parameters?.amount || !contractSchema.parameters?.release_condition}>
              Next
            </Button>
          </Grid2>
        </>
      )}
    </Container>
  );
};

export default EscrowStep;
