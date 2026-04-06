import React, { useState, useEffect } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError } from '../lib/utils';
import { OperationType } from '../types';

export default function GlobalAd({ currentView }: { currentView: string }) {
  const [adData, setAdData] = useState<{ adHtml: string | null, showOnHome: boolean, showOnWallet: boolean }>({
    adHtml: null,
    showOnHome: true,
    showOnWallet: false
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setAdData({
          adHtml: data.adHtml || null,
          showOnHome: data.showOnHome ?? true,
          showOnWallet: data.showOnWallet ?? false
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
    return () => unsubscribe();
  }, []);

  if (!adData.adHtml) return null;

  const shouldShow = (currentView === 'game' && adData.showOnHome) || 
                     (currentView === 'wallet' && adData.showOnWallet);

  if (!shouldShow) return null;

  return (
    <div 
      className="w-full p-4 bg-white border-t border-gray-100 mt-4 overflow-hidden"
      dangerouslySetInnerHTML={{ __html: adData.adHtml }}
    />
  );
}
