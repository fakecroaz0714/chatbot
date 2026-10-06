const LOCAL_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

const vercelOrigin = (host) => (host ? `https://${host.replace(/\/$/, '')}` : null);

export const corsOrigin = (origin, callback) => {
  const allowedOrigins = [
    process.env.CLIENT_URL?.replace(/\/$/, ''),
    vercelOrigin(process.env.VERCEL_URL),
    vercelOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    ...LOCAL_ORIGINS,
  ].filter(Boolean);

  // Requests without an Origin header include same-origin and server-to-server calls.
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Origin not allowed by CORS'));
};
