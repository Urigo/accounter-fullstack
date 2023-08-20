export const writeToClipboard = (text: string): void => {
  const onSuccess = (): void => {
    console.log('clipboard successfully set');
  };
  const onError = (): void => {
    console.log('clipboard failed');
  };

  navigator.clipboard.writeText(text).then(onSuccess, onError);
};
