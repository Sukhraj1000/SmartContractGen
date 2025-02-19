import React from "react";
import { useWizard } from "../../context/WizardContext";
import EscrowStep from "./EscrowStep";
import TokenVestingStep from "./TokenVestingStep";
import CrowdfundingStep from "./CrowdfundingStep";
import CustomStep from "./CustomStep";

const DynamicSteps = () => {
  const { contractSchema } = useWizard();

  if (contractSchema.contract_type === "escrow") return <EscrowStep />;
  if (contractSchema.contract_type === "token_vesting") return <TokenVestingStep />;
  if (contractSchema.contract_type === "crowdfunding") return <CrowdfundingStep />;
  if (contractSchema.contract_type === "custom") return <CustomStep />;
  
  return null;
};

export default DynamicSteps;
