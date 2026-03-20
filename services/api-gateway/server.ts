import app from './app';
import { env } from './src/config/env';

app.listen(env.PORT, () => {
  console.log(`RBSchool API Gateway running on port ${env.PORT}`);
});
