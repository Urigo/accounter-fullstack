export const writeToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(
    () => {
      console.log('clipboard successfully set');
    },
    () => {
      console.log('clipboard failed');
    }
  );
};
