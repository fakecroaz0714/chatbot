export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email.trim());
};

export const sanitizeString = (str) => {
  return typeof str === 'string' ? str.trim() : '';
};
