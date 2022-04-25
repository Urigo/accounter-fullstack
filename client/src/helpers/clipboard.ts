export const writeToClipboard = (text: string) => {
  const onSuccess = () => {
    console.log('clipboard successfully set');
  };
  const onError = () => {
    console.log('clipboard failed');
  };

  navigator.clipboard.writeText(text).then(onSuccess, onError);
};
