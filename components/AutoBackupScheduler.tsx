import React, { useEffect, useRef } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import { saveBackupFileOnlineOnly } from '../lib/supabaseOperations';

const AutoBackupScheduler: React.FC = () => {
  const { user } = usePharmacy();
  const hasRun = useRef(false);

  useEffect(() => {
    // Check every minute
    const interval = setInterval(() => {
      checkAndRunBackup();
    }, 60000);

    // Run initial check
    checkAndRunBackup();

    return () => clearInterval(interval);
  }, [user]);

  const checkAndRunBackup = async () => {
    // 1. Check time: 10:30 PM (22:30) 
    const now = new Date();
    
    // Get time in Manila timezone
    const manilaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const hours = manilaTime.getHours();
    const minutes = manilaTime.getMinutes();
    
    console.log(`AutoBackup Check: Manila Time is ${hours}:${minutes < 10 ? '0' + minutes : minutes}`);

    // 22:30 for production.
    if (hours === 22 && minutes === 30) {
      // 2. Check if already ran today
      // Use manilaTime for the date string to ensure consistency
      const today = manilaTime.toDateString();
      const lastRunDate = localStorage.getItem('stmargareth_last_auto_backup');
      
      if (lastRunDate !== today && !hasRun.current) {
        // Run backup
        hasRun.current = true; // Prevent double trigger in same session
        await performAutoBackup(today);
      }
    } else {
        // Reset the session ref if we are out of the minute window, so it can run tomorrow without reload
        if (hours !== 12 || minutes !== 50) {
            hasRun.current = false;
        }
    }
  };

  const performAutoBackup = async (todayDateString: string) => {
    try {
      console.log('Starting automatic backup...');
      
      const userId = user?.UserID || user?.id || null; // Can be null if system backup
      
      const response = await fetch('/api/backup/auto-backup.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.skipped) {
            console.warn('Automatic backup skipped (server cooldown):', data.message);
            // We still mark it as done for today so we don't retry endlessly
            localStorage.setItem('stmargareth_last_auto_backup', todayDateString);
        } else {
            console.log('Automatic backup successful:', data.message);
            localStorage.setItem('stmargareth_last_auto_backup', todayDateString);
            
            // Online-only exclusive mode: Save backup file ONLY to Supabase when online
            if (data.filename && data.file_size) {
              try {
                // Create a blob from the filename (for metadata)
                const backupBlob = new Blob([data.filename], { type: 'application/octet-stream' });
                const saveResult = await saveBackupFileOnlineOnly(
                  backupBlob, 
                  data.filename, 
                  'Auto'
                );
                console.log('Auto backup save result:', saveResult);
                
                if (saveResult.location === 'supabase') {
                  console.log('🟢 Auto backup saved EXCLUSIVELY to Supabase');
                } else {
                  console.log('🔴 Auto backup queued for later sync (system offline)');
                }
              } catch (backupError) {
                console.error('Error saving auto backup:', backupError);
              }
            }
            
            // Dispatch event so Settings page can refresh list
            window.dispatchEvent(new Event('backupCreated'));
        }
      } else {
        console.error('Automatic backup failed:', data.message);
      }
    } catch (error) {
      console.error('Error running automatic backup:', error);
    }
  };

  return null; // Render nothing
};

export default AutoBackupScheduler;
