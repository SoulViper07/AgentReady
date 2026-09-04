import Razorpay from 'razorpay';

const razorpayClientSingleton = () => {
  const key_id = process.env.RAZORPAY_KEY_ID?.trim() || 'rzp_test_placeholder';
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim() || 'rzp_test_placeholder_secret';

  return new Razorpay({
    key_id,
    key_secret,
  });
};

declare const globalThis: {
  razorpayGlobal: ReturnType<typeof razorpayClientSingleton>;
} & typeof global;

export const razorpay = globalThis.razorpayGlobal ?? razorpayClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.razorpayGlobal = razorpay;
}

export default razorpay;
