export const inferBloodType = (pattern: 'loop' | 'whorl' | 'arch') => {
  const map = {
    loop: { type: 'O', confidence: 0.94, trait: 'Acid-Dominant' },
    whorl: { type: 'A', confidence: 0.89, trait: 'Alkaline-Sensitive' },
    arch: { type: 'B', confidence: 0.85, trait: 'Balanced-Variable' }
  };
  return map[pattern];
};
