import React from "react";
import { Container, Typography, Paper, Button } from "@mui/material";
import { useWizard } from "../../context/WizardContext";

const ReviewStep = () => {
  const { contractSchema, setCurrentStep } = useWizard();

  return (
    <Container maxWidth="sm" sx={{ textAlign: "center", mt: 4 }}>
      <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Review & Confirm</Typography>
      <Paper sx={{ padding: 2, textAlign: "left", backgroundColor: "#333", color: "white", width: "100%" }}>
        <pre>{JSON.stringify(contractSchema, null, 2)}</pre>
      </Paper>
     </Container>
  );
};

export default ReviewStep;
