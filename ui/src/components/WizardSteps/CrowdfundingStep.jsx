import React, { useState } from "react";
import { Container, Grid, Typography, Button, TextField, Paper } from "@mui/material";
import { useWizard } from "../../context/WizardContext";

const CrowdfundingStep = () => {
  const { contractSchema, setContractSchema, setCurrentStep } = useWizard();
  const [step, setStep] = useState(1);

  const handleChange = (key, value) => {
    setContractSchema((prev) => ({
      ...prev,
      [key]: value // Ensures values like contract_name and contract_type are stored properly
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

          <TextField fullWidth type="number" label="Funding Goal" sx={{ mb: 2, backgroundColor: "white" }}
            value={contractSchema.parameters?.funding_goal || ""}
            onChange={(e) => handleParameterChange("funding_goal", e.target.value)} />
          <TextField fullWidth type="date" label="Deadline" sx={{ mb: 3, backgroundColor: "white" }}
            value={contractSchema.parameters?.deadline || ""}
            onChange={(e) => handleParameterChange("deadline", e.target.value)} />
          <Grid container justifyContent="space-between">
            <Button variant="outlined" onClick={() => setCurrentStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(2)}
              disabled={!contractSchema.contract_name || !contractSchema.parameters?.funding_goal || !contractSchema.parameters?.deadline}>
              Next
            </Button>
          </Grid>
        </>
      )}

      {step === 2 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 3: Contributors</Typography>
          <TextField fullWidth label="Contributor Address" sx={{ mb: 2, backgroundColor: "white" }}
            onChange={(e) => handleParameterChange("contributors", [e.target.value])} />
          <Grid container justifyContent="space-between">
            <Button variant="outlined" onClick={() => setStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(3)}>Next</Button>
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

export default CrowdfundingStep;
