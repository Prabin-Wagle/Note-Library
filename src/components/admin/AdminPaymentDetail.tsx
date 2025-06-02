import React, { useEffect, useState } from 'react';
import { collection, getDocs, Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface PaymentRequest {
  id: string;
  userId: string;
  status: string; // e.g., 'pending', 'approved', 'revoked'
  timestamp: any;
  paymentProofCpanelUrl?: string;
  paymentProofFileName?: string;
  requestedAt?: Timestamp;
  seriesPurchased?: string;
  userEmail?: string;
  userName?: string;
}

const AdminPaymentDetail: React.FC = () => {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({}); // Tracks loading state for buttons

  useEffect(() => {
    const fetchPaymentRequests = async () => {
      try {
        setLoading(true);
        setError(null);
        const querySnapshot = await getDocs(collection(db, 'paymentRequests'));
        const requests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRequest));
        setPaymentRequests(requests);
      } catch (err) {
        console.error("Error fetching payment requests: ", err);
        setError('Failed to fetch payment requests.');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentRequests();
  }, []);

  const handleAccessChange = async (request: PaymentRequest, grantAccess: boolean) => {
    if (!request.userId || !request.seriesPurchased) {
      const message = `Missing userId or seriesPurchased for request ID: ${request.id}`;
      setError(message);
      alert(message);
      return;
    }

    setUpdating(prev => ({ ...prev, [request.id]: true }));
    setError(null);

    let accessField: 'ioeAccess' | 'ceeAccess' | undefined;
    const series = request.seriesPurchased.toUpperCase();

    if (series === 'IOE') {
      accessField = 'ioeAccess';
    } else if (series === 'CEE') {
      accessField = 'ceeAccess';
    } else {
      const message = `Unknown series: ${request.seriesPurchased} for request ID: ${request.id}. Cannot change access.`;
      setError(message);
      alert(message);
      setUpdating(prev => ({ ...prev, [request.id]: false }));
      return;
    }

    try {
      // Step 1: Update user access in 'users' collection
      const userDocRef = doc(db, 'users', request.userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        throw new Error(`User document with ID ${request.userId} not found.`);
      }

      await updateDoc(userDocRef, {
        [accessField]: grantAccess // true for grant, false for revoke
      });
      console.log(`Successfully updated ${accessField} to ${grantAccess} for user ${request.userId}`);

      // Step 2: Update the payment request status
      const newStatus = grantAccess ? "approved" : "pending"; // Or "revoked" if you prefer for revoke action
      const paymentRequestRef = doc(db, "paymentRequests", request.id);
      await updateDoc(paymentRequestRef, {
        status: newStatus
      });
      console.log(`Successfully updated payment request ${request.id} status to ${newStatus}`);

      // Step 3: Update local state for payment requests
      setPaymentRequests(prevRequests =>
        prevRequests.map(r =>
          r.id === request.id ? { ...r, status: newStatus } : r
        )
      );

      const actionText = grantAccess ? "granted" : "revoked";
      alert(`Access for "${request.seriesPurchased}" ${actionText} for user "${request.userName || request.userId}". Payment status updated to ${newStatus}.`);

    } catch (err) {
      console.error("Error changing access: ", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      const actionText = grantAccess ? "granting" : "revoking";
      setError(`Failed during ${actionText} access for request ID: ${request.id}. Error: ${errorMessage}`);
      alert(`Error ${actionText} access for request ID: ${request.id}. Details: ${errorMessage}`);
    } finally {
      setUpdating(prev => ({ ...prev, [request.id]: false }));
    }
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading payment details...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4">Error: {error}</div>;
  }

  const formatDate = (timestamp: any) => {
    if (timestamp && timestamp.toDate) {
      return timestamp.toDate().toLocaleString();
    }
    if (timestamp && typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleString();
    }
    if (timestamp && typeof timestamp.seconds === 'number') {
        return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    return 'N/A';
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">Admin Payment Details</h2>
      {paymentRequests.length === 0 ? (
        <p>No payment requests found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 border-b text-left">Request ID</th>
                <th className="py-2 px-4 border-b text-left">User ID</th>
                <th className="py-2 px-4 border-b text-left">User Name</th>
                <th className="py-2 px-4 border-b text-left">User Email</th>
                <th className="py-2 px-4 border-b text-left">Status</th>
                <th className="py-2 px-4 border-b text-left">Date Requested</th>
                <th className="py-2 px-4 border-b text-left">Series Purchased</th>
                <th className="py-2 px-4 border-b text-left">Payment Proof</th>
                <th className="py-2 px-4 border-b text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentRequests.map(request => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{request.id}</td>
                  <td className="py-2 px-4 border-b">{request.userId}</td>
                  <td className="py-2 px-4 border-b">{request.userName || 'N/A'}</td>
                  <td className="py-2 px-4 border-b">{request.userEmail || 'N/A'}</td>
                  <td className="py-2 px-4 border-b">{request.status}</td>
                  <td className="py-2 px-4 border-b">{formatDate(request.requestedAt || request.timestamp)}</td>
                  <td className="py-2 px-4 border-b">{request.seriesPurchased || 'N/A'}</td>
                  <td className="py-2 px-4 border-b">
                    {request.paymentProofCpanelUrl ? (
                      <a
                        href={request.paymentProofCpanelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        View Proof
                      </a>
                    ) : (
                      request.paymentProofFileName || 'N/A'
                    )}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {request.status === 'approved' ? (
                      <button
                        onClick={() => handleAccessChange(request, false)} // Revoke access
                        disabled={updating[request.id]}
                        className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating[request.id] ? 'Processing...' : `Revoke ${request.seriesPurchased || 'N/A'} Access`}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAccessChange(request, true)} // Grant access
                        disabled={updating[request.id]}
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating[request.id] ? 'Processing...' : `Grant ${request.seriesPurchased || 'N/A'} Access`}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentDetail;
