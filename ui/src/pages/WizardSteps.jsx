import React from "react";
import StepOne from "../components/WizardSteps/StepOne";
import DynamicSteps from "../components/WizardSteps/DynamicStep";
import ReviewStep from "../components/WizardSteps/ReviewStep";
import { useWizard } from "../context/WizardContext";

/**
 * Wizard steps component that manages the multi-step contract generation process.
 * Renders different steps based on the current wizard state:
 * - Step 1: Initial contract type selection
 * - Step 2: Dynamic form based on contract type
 * - Step 3: Contract review and confirmation
 */
const WizardSteps = () => {
  const { currentStep, setCurrentStep } = useWizard();

  return (
    <>
      {/* Render appropriate step based on current wizard state */}
      {currentStep === 1 && <StepOne />}
      {currentStep === 2 && <DynamicSteps />}
      {currentStep === 3 && <ReviewStep />}
    </>
  );
};

export default WizardSteps;
