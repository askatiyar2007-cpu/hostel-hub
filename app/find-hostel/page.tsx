'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { 
  Search, 
  QrCode, 
  Key, 
  ArrowRight, 
  ArrowLeft,
  X, 
  Camera,
  Building2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';

export default function FindHostelPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [hostelIdInput, setHostelIdInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<any>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a hostel name or location');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`)
        .eq('status', 'active')
        .limit(10);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No hostels found matching your search');
        setLoading(false);
      } else if (data.length === 1) {
        router.push(`/hostels/${data[0].id}`);
        setLoading(false);
      } else {
        // TODO: Show search results list
        toast.info('Multiple hostels found - showing first result');
        router.push(`/hostels/${data[0].id}`);
        setLoading(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search hostels');
      setLoading(false);
    }
  };

  const handleManualId = async () => {
    if (!hostelIdInput.trim()) {
      toast.error('Please enter a Hostel ID');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('*')
        .eq('id', hostelIdInput.trim())
        .eq('status', 'active')
        .single();

      if (error || !data) {
        toast.error('Hostel not found or not available');
        setLoading(false);
        return;
      }

      router.push(`/hostels/${data.id}`);
      setLoading(false);
    } catch (error) {
      console.error('Hostel lookup error:', error);
      toast.error('Failed to find hostel');
      setLoading(false);
    }
  };

  const startScanner = async () => {
    if (!isMobile) {
      toast.info('Please use your phone to scan QR codes');
      return;
    }

    setIsScanning(true);
    
    // Initialize scanner after state update
    setTimeout(() => {
      const readerElement = document.getElementById('qr-reader');
      if (!readerElement) return;

      // Dynamic import only when needed
      import('html5-qrcode').then((mod) => {
        if (!scannerRef.current) {
          scannerRef.current = new mod.Html5QrcodeScanner(
            'qr-reader',
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
          );
        }

        scannerRef.current.render(onScanSuccess, onScanFailure)
          .then(() => {
            console.log('Scanner started successfully');
          })
          .catch((err: any) => {
            console.error('Scanner error:', err);
            toast.error('Failed to start camera. Please ensure camera permission is granted.');
            setIsScanning(false);
          });
      }).catch(() => {
        toast.error('Failed to load QR scanner');
        setIsScanning(false);
      });
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
    setIsScanning(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    console.log('QR scanned:', decodedText);
    stopScanner();

    // Validate QR content
    let hostelId: string | null = null;

    // Check if it's a full URL
    try {
      const url = new URL(decodedText);
      // Check if it's a HostelHub URL
      if (url.hostname === window.location.hostname || url.hostname.includes('hostelhub')) {
        const pathParts = url.pathname.split('/');
        const hostelsIndex = pathParts.indexOf('hostels');
        if (hostelsIndex !== -1 && pathParts[hostelsIndex + 1]) {
          hostelId = pathParts[hostelsIndex + 1];
        }
      }
    } catch {
      // Not a URL, check if it's a raw hostel ID
      if (decodedText.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        hostelId = decodedText;
      }
    }

    if (!hostelId) {
      toast.error('Invalid HostelHub QR code');
      return;
    }

    // Verify hostel exists and is active
    setLoading(true);
    try {
      const { data } = await supabase
        .from('hostels')
        .select('*')
        .eq('id', hostelId)
        .eq('status', 'active')
        .single();

      if (!data) {
        toast.error('Hostel not found or not available');
      } else {
        router.push(`/hostels/${hostelId}`);
      }
    } catch {
      toast.error('Failed to validate hostel');
    } finally {
      setLoading(false);
    }
  };

  const onScanFailure = () => {
    // Suppress console spam for normal scan failures
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-slate-600" />
          </Link>
          <h1 className="text-lg font-bold text-slate-900">Find a Hostel</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Search Option */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                <Search size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Search by Name or Location</h2>
                <p className="text-sm text-slate-500">Find hostels by name, city, or location</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="Search hostel name, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch}
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Scan Option */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <QrCode size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Scan Hostel QR</h2>
                <p className="text-sm text-slate-500">
                  {isMobile ? 'Scan the QR code from the hostel owner' : 'Use your phone to scan the hostel QR code'}
                </p>
              </div>
            </div>
            <Button
              onClick={startScanner}
              disabled={!isMobile}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isMobile ? (
                <>
                  <Camera size={16} className="mr-2" />
                  Scan Hostel QR
                </>
              ) : (
                <>
                  <QrCode size={16} className="mr-2" />
                  Scan with your phone
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Manual ID Option */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Key size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Enter Hostel ID</h2>
                <p className="text-sm text-slate-500">Enter the unique Hostel ID manually</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder="e4c72399-304d-4298-9908-2ea..."
                value={hostelIdInput}
                onChange={(e) => setHostelIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualId()}
                className="flex-1 font-mono text-sm"
              />
              <Button 
                onClick={handleManualId}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border border-slate-200 bg-slate-50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-teal-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">About HostelHub</h3>
                <p className="text-sm text-slate-600">
                  HostelHub connects students with verified hostels. Ask your hostel owner for their unique QR code or Hostel ID to find their property quickly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Scanner Section */}
        {isScanning && (
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Scan Hostel QR</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={stopScanner}
                  className="h-8 w-8"
                >
                  <X size={18} />
                </Button>
              </div>
              <div id="qr-reader" className="w-full"></div>
              <p className="text-center text-sm text-slate-500 mt-4">
                Point your camera at the hostel QR code
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
