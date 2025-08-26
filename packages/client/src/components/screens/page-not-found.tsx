import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';

export const PageNotFound = () => (
  <Card className="m-5">
    <CardHeader>
      <CardTitle>404</CardTitle>
    </CardHeader>
    <CardContent>
      <p>Page not found</p>
    </CardContent>
  </Card>
);
