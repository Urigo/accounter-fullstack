import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';

export const NetworkError = () => (
  <Card className="m-5">
    <CardHeader>
      <CardTitle>Network Error</CardTitle>
    </CardHeader>
    <CardContent>
      <p>
        There seems to be an issue with the connection to the server. Please check your internet
        connection and try again.
      </p>
    </CardContent>
  </Card>
);
