import React, { createContext, useContext, useState } from "react";

const WizardContext = createContext();

export function WizardProvider({ children }) {
  const [contractSchema, setContractSchema] = useState({});
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <WizardContext.Provider value={{ contractSchema, setContractSchema, currentStep, setCurrentStep }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  return useContext(WizardContext);
}
