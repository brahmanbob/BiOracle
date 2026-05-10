export const triggerFrequencyRemedy = (hz: number) => {
  // Logic to trigger the S21's Taptic Engine at specific Rife frequencies
  if (hz === 7.83) {
    return "Vagus Reset: Continuous Low Pulse";
  } else if (hz === 528) {
    return "Repair: Double-Tap High Frequency";
  }
  return "Standard Calm";
};
