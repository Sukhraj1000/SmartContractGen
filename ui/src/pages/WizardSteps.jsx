import React from "react";
import StepOne from "../components/WizardSteps/StepOne";
import DynamicSteps from "../components/WizardSteps/DynamicStep";
import ReviewStep from "../components/WizardSteps/ReviewStep";
import { useWizard } from "../context/WizardContext";

const WizardSteps = () => {
  const { currentStep, setCurrentStep } = useWizard();

  return (
    <>
      {currentStep === 1 && <StepOne />}
      {currentStep === 2 && <DynamicSteps />}
      {currentStep === 3 && <ReviewStep />}
  
    </>
  );
};

export default WizardSteps;
