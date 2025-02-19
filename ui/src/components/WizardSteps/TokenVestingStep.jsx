import React, { useState } from "react";
import { Container, Grid, Typography, Button, TextField, Paper } from "@mui/material";
import { useWizard } from "../../context/WizardContext";

const TokenVestingStep = () => {
  const { contractSchema, setContractSchema, setCurrentStep } = useWizard();
  const [step, setStep] = useState(1);

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
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 2: Define Vesting Details</Typography>
          <TextField fullWidth label="Beneficiary Wallet" sx={{ mb: 2, backgroundColor: "white" }}
            value={contractSchema.parameters?.beneficiary || ""}
            onChange={(e) => handleChange("parameters", "beneficiary", e.target.value)}
          />
          <TextField fullWidth type="number" label="Total Tokens" sx={{ mb: 3, backgroundColor: "white" }}
            value={contractSchema.parameters?.total_tokens || ""}
            onChange={(e) => handleChange("parameters", "total_tokens", e.target.value)}
          />
          <Grid container justifyContent="space-between">
            <Button variant="outlined" onClick={() => setCurrentStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(2)}
              disabled={!contractSchema.parameters?.beneficiary || !contractSchema.parameters?.total_tokens}>
              Next
            </Button>
          </Grid>
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
          <Grid container justifyContent="space-between">
            <Button variant="outlined" onClick={() => setStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(3)}
              disabled={!contractSchema.parameters?.vesting_period || !contractSchema.parameters?.cliff_period}>
              Next
            </Button>
          </Grid>
        </>
      )}

      {step === 3 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 4: Review & JSON Summary</Typography>
          <Paper sx={{ padding: 2, textAlign: "left", backgroundColor: "#333", color: "white", width: "100%" }}>
            <pre>{JSON.stringify(contractSchema, null, 2)}</pre>
          </Paper>
          <Grid container justifyContent="space-between" sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={() => setStep(2)}>Back</Button>
            <Button variant="contained" color="success" onClick={() => console.log("Contract Submitted:", contractSchema)}>
              Submit Contract
            </Button>
          </Grid>
        </>
      )}
    </Container>
  );
};

export default TokenVestingStep;
