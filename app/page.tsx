"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Plus,
  MapPin,
  Award,
  Coffee,
  Compass,
  Search,
  DollarSign,
  Star,
  Camera,
  ChevronRight,
  Navigation,
  Map as MapIcon,
  X,
  RefreshCw,
  Database
} from "lucide-react";

interface EinspannerRecord {
  id: string;
  place: string;
  photo: string;
  price: number;
  sweetness: number; // 1 (덜 달다) to 5 (달다)
  texture: number;   // 1 (묽다) to 5 (꾸덕하다)
  coffeeTaste: number; // 1 (산미) to 5 (고소)
  notes: string;
  rating: number; // 1 to 5 overall
  lat: number; // 0 to 100 for grid X
  lng: number; // 0 to 100 for grid Y
  distance?: number;
  createdAt: string;
}

// Real Seoul Einspanner cafe data with actual GPS coordinates (Default empty, only user created)
const INITIAL_CAFES: EinspannerRecord[] = [];

// Helper to normalize mock data (1-5 scale) to form data (1-10 scale)
const normalizeVal = (val: number, id: string) => {
  return !id.startsWith("user_") ? val * 2 : val;
};

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "record" | "map" | "ranking">("home");
  const [records, setRecords] = useState<EinspannerRecord[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 50, lng: 50 });
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Record Form States
  const [place, setPlace] = useState("");
  const [price, setPrice] = useState<number>(5500);
  const [sweetness, setSweetness] = useState<number>(0);
  const [texture, setTexture] = useState<number>(0);
  const [coffeeTaste, setCoffeeTaste] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number>(0); // Default to no rating selected
  const [photo, setPhoto] = useState<string>("");
  const [customCoord, setCustomCoord] = useState<{ lat: number; lng: number } | null>(null);

  // Place search autocomplete states
  interface PlaceSuggestion {
    title: string;
    address: string;
    roadAddress: string;
    category: string;
    lat: number;
    lng: number;
  }
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Map States
  const [selectedMapCafe, setSelectedMapCafe] = useState<EinspannerRecord | null>(null);
  const [temporaryPin, setTemporaryPin] = useState<{ lat: number; lng: number } | null>(null);

  // Ranking Filters
  const [rankingFilter, setRankingFilter] = useState<"rating" | "cream-sweet" | "cream-texture" | "coffee-taste" | "price" | "distance">("rating");

  const [isSyncing, setIsSyncing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [naverMapLoaded, setNaverMapLoaded] = useState(false);
  const [randomCafes, setRandomCafes] = useState<EinspannerRecord[]>([]);

  // Shuffle cafes for random recommendation
  useEffect(() => {
    if (records.length > 0) {
      const shuffled = [...records].sort(() => Math.random() - 0.5);
      setRandomCafes(shuffled);
    }
  }, [records]);

  // Sync records with Supabase
  const syncWithSupabase = async (localRecords: EinspannerRecord[]) => {
    setIsSyncing(true);
    try {
      // 1. Fetch current records from Supabase
      const { data: dbRecords, error: fetchError } = await supabase
        .from('einspanner_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const syncedList: EinspannerRecord[] = [];

      // Only use records that exist in the database (Supabase is the single source of truth)
      if (dbRecords) {
        dbRecords.forEach(db => {
          let lat = db.lat;
          let lng = db.lng;
          // Auto-correct coordinate scaling bug (if stored as 370.x instead of 37.x)
          if (lat > 90) lat = lat / 10;
          if (lng > 180) lng = lng / 10;

          syncedList.push({
            id: db.id,
            place: db.place,
            photo: db.photo || "",
            price: db.price,
            sweetness: db.sweetness,
            texture: db.texture,
            coffeeTaste: db.coffee_taste,
            notes: db.notes || "",
            rating: db.rating,
            lat: lat,
            lng: lng,
            createdAt: db.created_at
          });
        });
      }

      setRecords(syncedList);
      localStorage.setItem("einspanner_records", JSON.stringify(syncedList));
    } catch (err) {
      console.error("Supabase sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Load records on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);

    const DATA_VERSION = "v2_real_cafes";
    const savedVersion = localStorage.getItem("einspanner_data_version");
    const saved = localStorage.getItem("einspanner_records");

    let initialList: EinspannerRecord[] = [];

    if (savedVersion !== DATA_VERSION || !saved) {
      initialList = INITIAL_CAFES;
      setRecords(INITIAL_CAFES);
      localStorage.setItem("einspanner_records", JSON.stringify(INITIAL_CAFES));
      localStorage.setItem("einspanner_data_version", DATA_VERSION);
    } else {
      try {
        initialList = JSON.parse(saved);
        setRecords(initialList);
      } catch (e) {
        initialList = INITIAL_CAFES;
        setRecords(INITIAL_CAFES);
        localStorage.setItem("einspanner_records", JSON.stringify(INITIAL_CAFES));
      }
    }

    // Trigger Supabase Sync on load
    syncWithSupabase(initialList);

    // Try to fetch location on mount
    fetchCurrentLocation();

    // Check if naver map script is loaded
    const checkNaverMap = setInterval(() => {
      if (typeof window !== "undefined" && (window as any).naver) {
        setNaverMapLoaded(true);
        clearInterval(checkNaverMap);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      clearInterval(checkNaverMap);
    };
  }, []);

  // Scroll triggered animations observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.05 }
    );

    const elements = document.querySelectorAll(".scroll-fade");
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, [activeTab, records]);

  // Save records to local storage
  const saveRecords = (newRecords: EinspannerRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem("einspanner_records", JSON.stringify(newRecords));
  };

  // Get distance helper using Haversine formula (returns meters)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return Math.round(d);
  };

  // Enhance records with calculated distance based on user location
  const enhancedRecords = records.map(rec => {
    return {
      ...rec,
      distance: calculateDistance(rec.lat, rec.lng, userLocation.lat, userLocation.lng)
    };
  });

  // Handle Photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Form submit
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!place.trim()) return;

    setIsSyncing(true);
    let finalPhotoUrl = photo;

    try {
      // 1. If there is a photoFile, upload to Supabase Storage first
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `records/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('einspanner')
          .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: publicUrlData } = supabase.storage
          .from('einspanner')
          .getPublicUrl(filePath);

        if (publicUrlData) {
          finalPhotoUrl = publicUrlData.publicUrl;
        }
      }

      // 2. Setup lat/lng
      const lat = customCoord ? customCoord.lat : (userLocation.lat + (Math.random() - 0.5) * 0.02);
      const lng = customCoord ? customCoord.lng : (userLocation.lng + (Math.random() - 0.5) * 0.02);

      const recordId = "user_" + Date.now();
      const newRecord: EinspannerRecord = {
        id: recordId,
        place,
        photo: finalPhotoUrl || "",
        price,
        sweetness,
        texture,
        coffeeTaste,
        notes,
        rating,
        lat,
        lng,
        createdAt: new Date().toISOString()
      };

      // 3. Save locally
      const updated = [newRecord, ...records];
      saveRecords(updated);

      // 4. Insert to Supabase DB
      const { error: dbError } = await supabase
        .from('einspanner_records')
        .insert({
          id: recordId,
          place,
          photo: finalPhotoUrl || "",
          price,
          sweetness,
          texture,
          coffee_taste: coffeeTaste,
          notes,
          rating,
          lat,
          lng,
          created_at: newRecord.createdAt
        });

      if (dbError) throw dbError;

      // Reset Form
      setPlace("");
      setPrice(5500);
      setSweetness(0);
      setTexture(0);
      setCoffeeTaste(0);
      setNotes("");
      setRating(0);
      setPhoto("");
      setPhotoFile(null);
      setCustomCoord(null);
      setTemporaryPin(null);
      setPlaceSuggestions([]);
      setShowSuggestions(false);

      // Go to map and select the newly added cafe to open its drawer details
      setSelectedMapCafe(newRecord);
      setActiveTab("map");
    } catch (err) {
      console.error("Failed to save record:", err);
      alert("기록 등록 중 오류가 발생했습니다. 로컬에 임시 저장되었습니다.");
      
      // Fallback: save locally at least
      const lat = customCoord ? customCoord.lat : (userLocation.lat + (Math.random() - 0.5) * 0.02);
      const lng = customCoord ? customCoord.lng : (userLocation.lng + (Math.random() - 0.5) * 0.02);
      const newRecord: EinspannerRecord = {
        id: "user_" + Date.now(),
        place,
        photo: photo || "",
        price,
        sweetness,
        texture,
        coffeeTaste,
        notes,
        rating,
        lat,
        lng,
        createdAt: new Date().toISOString()
      };
      const updated = [newRecord, ...records];
      saveRecords(updated);

      setPlace("");
      setPrice(5500);
      setSweetness(0);
      setTexture(0);
      setCoffeeTaste(0);
      setNotes("");
      setRating(0);
      setPhoto("");
      setPhotoFile(null);
      setCustomCoord(null);
      setTemporaryPin(null);
      setPlaceSuggestions([]);
      setShowSuggestions(false);

      setSelectedMapCafe(newRecord);
      setActiveTab("map");
    } finally {
      setIsSyncing(false);
    }
  };

  // Setup current location (Seoul City Hall as default base: 37.5665, 126.9780)
  const fetchCurrentLocation = () => {
    setIsGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setIsGettingLocation(false);
        },
        () => {
          setTimeout(() => {
            // Default to Seoul City Hall
            setUserLocation({ lat: 37.5665, lng: 126.9780 });
            setIsGettingLocation(false);
          }, 800);
        }
      );
    } else {
      setTimeout(() => {
        setUserLocation({ lat: 37.5665, lng: 126.9780 });
        setIsGettingLocation(false);
      }, 800);
    }
  };

  // Map Pin Selection or Grid Click
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Legacy grid coordinate click - deprecated in favor of real Naver Map API click handler
  };

  // Prepare Record from map pin
  const handleRecordFromMap = () => {
    if (temporaryPin) {
      setCustomCoord(temporaryPin);
      setActiveTab("record");
    }
  };

  // Naver Map initialization hook
  const mapRef = React.useRef<HTMLDivElement>(null);
  const homeMapRef = React.useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [homeMapInstance, setHomeMapInstance] = useState<any>(null);

  // Initialize Naver Map for Main Screen Map Section
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).naver || !(window as any).naver.maps || !homeMapRef.current || activeTab !== "home") return;

    const naver = (window as any).naver;
    const center = new naver.maps.LatLng(userLocation.lat, userLocation.lng);

    const map = new naver.maps.Map(homeMapRef.current, {
      center: center,
      zoom: 12,
      minZoom: 10,
      zoomControl: false,
      mapDataControl: false,
      logoControl: false,
      scaleControl: false
    });

    setHomeMapInstance(map);

    // User Location Marker
    new naver.maps.Marker({
      position: center,
      map: map,
      icon: {
        content: `
          <div class="relative flex items-center justify-center">
            <div class="w-4 h-4 bg-blue-500/30 rounded-full flex items-center justify-center animate-ping absolute"></div>
            <div class="w-3.5 h-3.5 bg-blue-600 rounded-full border border-white flex items-center justify-center shadow">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
        `,
        anchor: new naver.maps.Point(7, 7)
      }
    });

    // Cafe Markers
    records.forEach(cafe => {
      // 장소명이 '기억안남' 또는 '기억 안남' 등일 경우 지도 핀에서 배제
      const isForgotten = cafe.place.replace(/\s/g, "").includes("기억안남");
      if (isForgotten) return;

      new naver.maps.Marker({
        position: new naver.maps.LatLng(cafe.lat, cafe.lng),
        map: map,
        icon: {
          content: `
            <div class="relative flex items-center justify-center">
              <div class="w-5 h-5 bg-white text-[#292929] border border-[#292929] flex items-center justify-center font-mono text-[8px] font-bold">
                ☕
              </div>
            </div>
          `,
          anchor: new naver.maps.Point(10, 10)
        }
      });
    });

  }, [activeTab, userLocation, records, naverMapLoaded]);

  // Initialize Naver Map for Map Tab (Full Screen Map)
  // Initialize Naver Map for Map Tab (Full Screen Map / Detailed Card View)
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).naver || !(window as any).naver.maps || !mapRef.current || activeTab !== "map") return;

    const naver = (window as any).naver;
    
    // 만약 선택된 카페 상세 정보를 보고 있다면 해당 카페를 중심점으로 지정하고 좀 더 줌인합니다.
    const center = selectedMapCafe
      ? new naver.maps.LatLng(selectedMapCafe.lat, selectedMapCafe.lng)
      : new naver.maps.LatLng(userLocation.lat, userLocation.lng);
    const initialZoom = selectedMapCafe ? 15 : 13;

    const map = new naver.maps.Map(mapRef.current, {
      center: center,
      zoom: initialZoom,
      zoomControl: true,
      zoomControlOptions: {
        position: naver.maps.Position.RIGHT_BOTTOM
      }
    });

    setMapInstance(map);

    // User Location Marker
    const userCenter = new naver.maps.LatLng(userLocation.lat, userLocation.lng);
    new naver.maps.Marker({
      position: userCenter,
      map: map,
      icon: {
        content: `
          <div class="relative flex items-center justify-center">
            <div class="w-5 h-5 bg-blue-500/30 rounded-full flex items-center justify-center animate-ping absolute"></div>
            <div class="w-4.5 h-4.5 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow-md">
              <div class="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
        `,
        anchor: new naver.maps.Point(9, 9)
      }
    });

    // Active Markers List
    const markers: any[] = [];

    // Cafe Markers
    records.forEach(cafe => {
      // 장소명이 '기억안남' 또는 '기억 안남' 등일 경우 지도 핀에서 배제
      const isForgotten = cafe.place.replace(/\s/g, "").includes("기억안남");
      if (isForgotten) return;

      const isSelected = selectedMapCafe && selectedMapCafe.id === cafe.id;
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(cafe.lat, cafe.lng),
        map: map,
        title: cafe.place,
        icon: {
          content: `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div class="w-6 h-6 ${isSelected ? "bg-[#292929] text-white" : "bg-white text-[#292929]"} border border-[#292929] flex items-center justify-center font-mono text-[9px] font-bold transition-all duration-150">
                ☕
              </div>
            </div>
          `,
          anchor: new naver.maps.Point(12, 12)
        }
      });

      naver.maps.Event.addListener(marker, "click", () => {
        setSelectedMapCafe(cafe);
        setTemporaryPin(null);
      });

      markers.push(marker);
    });

    // Temporary Pin Variable for Click
    let tempMarker: any = null;

    // Map Click Listener to create new Cafe Pin
    naver.maps.Event.addListener(map, "click", (e: any) => {
      const clickedLatLng = e.coord;
      const clickedLat = clickedLatLng.lat();
      const clickedLng = clickedLatLng.lng();

      setTemporaryPin({ lat: clickedLat, lng: clickedLng });
      setSelectedMapCafe(null);

      if (tempMarker) {
        tempMarker.setMap(null);
      }

      tempMarker = new naver.maps.Marker({
        position: clickedLatLng,
        map: map,
        icon: {
          content: `
            <div class="flex flex-col items-center">
              <div class="bg-[#292929] text-white font-mono text-[9px] tracking-[0.1em] uppercase py-1 px-2 border border-[#292929] whitespace-nowrap mb-1">
                ADD HERE +
              </div>
              <div class="w-6 h-6 bg-white border border-[#292929] flex items-center justify-center">
                <span class="text-sm font-light text-[#292929]">+</span>
              </div>
            </div>
          `,
          anchor: new naver.maps.Point(40, 48)
        }
      });

      naver.maps.Event.addListener(tempMarker, "click", () => {
        setCustomCoord({ lat: clickedLat, lng: clickedLng });
        setActiveTab("record");
      });
    });

  }, [activeTab, userLocation, records, naverMapLoaded, selectedMapCafe]);

  // Sorting logic for rankings
  const getSortedRankings = () => {
    let list = [...enhancedRecords];
    if (searchQuery.trim()) {
      list = list.filter(rec =>
        rec.place.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.notes.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    switch (rankingFilter) {
      case "rating":
        return list.sort((a, b) => b.rating - a.rating);
      case "cream-sweet":
        return list.sort((a, b) => b.sweetness - a.sweetness);
      case "cream-texture":
        return list.sort((a, b) => b.texture - a.texture);
      case "coffee-taste":
        return list.sort((a, b) => b.coffeeTaste - a.coffeeTaste);
      case "price":
        return list.sort((a, b) => a.price - b.price);
      case "distance":
        return list.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
      default:
        return list;
    }
  };

  // Search filtered records
  const filteredRecords = enhancedRecords.filter(rec =>
    rec.place.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rec.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full min-h-screen bg-white font-sans relative border-x border-[#292929]">
      {/* Splash Screen */}
      {showSplash && (
        <div className="absolute inset-0 bg-[#292929] z-50 flex flex-col items-center justify-center animate-splash p-6 text-center">
          <div className="flex flex-col items-center gap-6">
            {/* Minimalist Graphic of an Einspanner Glass */}
            <div className="animate-coffee">
              <svg className="w-24 h-32" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Glass Cup Outline */}
                <path d="M20 30 L30 130 L90 130 L100 30 Z" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
                {/* Coffee Layer */}
                <path d="M28 85 L30 125 L90 125 L92 85 Z" fill="#ffffff" opacity="0.15" />
                {/* Cream Layer (Flat Swiss Line Art) */}
                <path d="M20 30 L100 30 L92 85 L28 85 Z" fill="#ffffff" />
                {/* Division line */}
                <line x1="28" y1="85" x2="92" y2="85" stroke="#292929" strokeWidth="1" />
              </svg>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-white font-mono text-[11px] tracking-[0.2em] uppercase opacity-60">Einspänner Archiving App</h2>
              <h1 className="text-white text-2xl font-light tracking-[-0.02em] leading-normal uppercase">
                EINSPÄNNER ROAD
              </h1>
            </div>

            <div className="w-12 h-[1px] bg-white opacity-40 mt-4 animate-pulse-slow"></div>
          </div>
        </div>
      )}

      {/* Centered Transparent Title Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md text-[#292929] px-4 py-4 flex items-center justify-center border-b border-[#292929] z-30 min-h-[58px]">
        {activeTab !== "home" && activeTab !== "record" && (
          <button
            onClick={() => { setActiveTab("home"); setSelectedMapCafe(null); }}
            className="absolute left-4 p-2 hover:bg-zinc-100 transition-colors flex items-center justify-center border border-transparent z-10"
          >
            <svg className="w-4 h-4 text-[#292929]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {(activeTab === "home" || activeTab === "ranking") ? (
          <div className={`w-full flex items-center justify-between gap-3 ${activeTab === "ranking" ? "pl-10 pr-20" : ""}`}>
            {/* Sleek Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#292929] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="카페 이름 또는 노트 검색..."
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim() && activeTab !== "ranking") {
                    setActiveTab("ranking");
                  }
                }}
                className="w-full bg-white text-sm text-[#292929] pl-9 pr-8 py-2 rounded-none border border-[#292929] focus:outline-none focus:bg-zinc-50 placeholder-[#7a7a7a] tracking-tight"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200"
                >
                  <X className="w-3 h-3 text-[#292929]" />
                </button>
              )}
            </div>

            {/* Sync Button */}
            <button
              onClick={() => syncWithSupabase(records)}
              disabled={isSyncing}
              className={`px-3 py-2 bg-white text-[#292929] hover:bg-[#292929] hover:text-white transition-all duration-150 border border-[#292929] shrink-0 flex items-center gap-1.5 ${isSyncing ? "opacity-60 cursor-not-allowed" : ""}`}
              title="데이터 동기화"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="text-[10px] font-mono font-medium tracking-[0.1em] uppercase">SYNC</span>
            </button>
          </div>
        ) : null}
        {(activeTab === "map") && (
          <button
            onClick={() => { setActiveTab("home"); setSelectedMapCafe(null); }}
            className="absolute right-4 text-xs font-mono font-medium tracking-[0.1em] uppercase bg-white text-[#292929] hover:bg-[#292929] hover:text-white border border-[#292929] px-3 py-1.5 transition-all z-10"
          >
            CLOSE
          </button>
        )}
        {activeTab === "ranking" && (
          <button
            onClick={() => { setActiveTab("home"); setSelectedMapCafe(null); }}
            className="absolute right-4 text-xs font-mono font-medium tracking-[0.1em] uppercase bg-white text-[#292929] hover:bg-[#292929] hover:text-white border border-[#292929] px-3 py-1.5 transition-all z-10"
          >
            CLOSE
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-8 overflow-y-auto">
        {/* HOME TAB (Main stacked sections: 기록하기 -> 랭킹 -> 지도) */}
        {activeTab === "home" && (
          <div className="flex flex-col gap-8 p-4 animate-fade-in">
            {/* 1. 지도 섹션 (내위치 기반) */}
            <div className="bg-white border border-[#292929] p-4 flex flex-col gap-4 stagger-item delay-1">
              <div className="flex justify-between items-center border-b border-[#292929] pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium tracking-[0.1em] uppercase text-[#292929]">01 / LOCATION MAP</span>
                </div>
                <button
                  onClick={() => setActiveTab("map")}
                  className="font-mono text-[10px] font-medium tracking-[0.15em] text-[#292929] uppercase hover:underline"
                >
                  FULL VIEW →
                </button>
              </div>

              {/* Naver Map Preview Container */}
              <div
                ref={homeMapRef}
                className="w-full aspect-video bg-zinc-50 overflow-hidden border border-[#292929]"
                style={{ height: "200px" }}
              ></div>
            </div>

            {/* 2. 기록하기 Card Button */}
            <div 
              onClick={() => {
                setActiveTab("record");
                setTimeout(() => {
                  fileInputRef.current?.click();
                }, 50);
              }}
              className="cursor-pointer bg-white border border-[#292929] py-8 px-6 text-[#292929] hover:bg-[#292929] hover:text-white transition-all duration-200 flex flex-col items-center justify-center gap-4 stagger-item delay-2 group"
            >
              <div className="font-mono text-xs font-medium tracking-[0.2em] uppercase">02 / NEW ARCHIVE</div>
              <h2 className="text-3xl font-light tracking-[-0.03em] uppercase text-center leading-none">
                ADD RECORD
              </h2>
              <div className="text-[10px] font-mono tracking-[0.1em] uppercase opacity-60 group-hover:opacity-100 transition-opacity">
                TAP TO CAPTURE & ARCHIVE +
              </div>
            </div>

            {/* 3. 랜덤 추천 섹션 (좌우 슬라이드) */}
            <div className="bg-white border border-[#292929] p-4 flex flex-col gap-4 stagger-item delay-3">
              <div className="flex justify-between items-center border-b border-[#292929] pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium tracking-[0.1em] uppercase text-[#292929]">03 / RECOMMENDED</span>
                </div>
                <button
                  onClick={() => setActiveTab("ranking")}
                  className="font-mono text-[10px] font-medium tracking-[0.15em] text-[#292929] uppercase hover:underline"
                >
                  ALL LIST →
                </button>
              </div>

              {/* 좌우 슬라이드 리스트 */}
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar">
                {randomCafes.map((cafe) => (
                  <div
                    key={cafe.id}
                    onClick={() => { setSelectedMapCafe(cafe); setActiveTab("map"); }}
                    className="w-[180px] shrink-0 snap-start bg-white border border-[#292929] overflow-hidden hover:bg-zinc-50 transition-colors cursor-pointer flex flex-col"
                  >
                    {/* 이미지 영역 */}
                    <div className="w-full aspect-square bg-zinc-50 border-b border-[#292929] flex items-center justify-center overflow-hidden relative">
                      {cafe.photo ? (
                        <img src={cafe.photo} alt={cafe.place} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#292929] flex items-center justify-center">
                          <span className="font-mono text-[10px] tracking-[0.2em] text-white uppercase">NO IMAGE</span>
                        </div>
                      )}
                    </div>

                    {/* 정보 영역 */}
                    <div className="p-3 flex flex-col gap-2 justify-between flex-1">
                      <h4 className="text-xs font-semibold text-[#292929] truncate uppercase tracking-tight">{cafe.place}</h4>
                      <div className="flex items-center justify-between mt-auto pt-1 border-t border-zinc-100">
                        <span className="text-[10px] text-[#292929] font-mono tracking-tight">{cafe.price.toLocaleString()} KRW</span>
                        <div className="flex items-center gap-0.5 text-[#292929] font-mono text-[10px]">
                          <span>★ {cafe.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RECORD TAB - Instagram New Post Style */}
        {activeTab === "record" && (
          <div className="absolute inset-0 bg-white z-40 flex flex-col h-full">
            {/* Header: Fixed/Sticky at top */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-white shrink-0">
              <button 
                type="button" 
                onClick={() => { setActiveTab("home"); setPhoto(""); setPlace(""); }}
                className="text-xs font-bold text-zinc-800"
              >
                취소
              </button>
              <h2 className="text-sm font-bold text-zinc-900 pr-4">새 게시물</h2>
              <div className="w-6"></div> {/* Spacer to balance cancel button */}
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto">
              {/* 1. Square Image Container (1:1 Ratio) */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-square bg-zinc-50 border-b border-zinc-100 relative flex items-center justify-center cursor-pointer group overflow-hidden"
              >
                {photo ? (
                  <img src={photo} alt="Upload Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400 group-hover:text-zinc-600 transition-colors">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-300 flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold">아인슈페너 사진 추가</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              {/* Form Fields Section (Ordered: Place, Price, Rating, Cream, Coffee) */}
              <div className="flex flex-col divider-y divider-zinc-100">
                
                {/* 1. 장소명 (Place Name) - Naver Local Search API Autocomplete */}
                <div className="p-4 flex flex-col gap-1 border-b border-zinc-100 relative">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 border border-zinc-200">
                      <MapPin className="w-4.5 h-4.5 text-[#8B5A2B]" />
                    </div>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="카페 이름을 입력하세요..."
                      value={place}
                      onFocus={() => { if (placeSuggestions.length > 0) setShowSuggestions(true); }}
                      onBlur={() => { setTimeout(() => setShowSuggestions(false), 150); }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlace(val);
                        setShowSuggestions(true);

                        // Clear previous timer
                        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

                        if (val.trim().length < 2) {
                          setPlaceSuggestions([]);
                          setIsSearchingPlace(false);
                          return;
                        }

                        setIsSearchingPlace(true);
                        // Debounce 400ms then call server-side API route
                        searchTimeoutRef.current = setTimeout(async () => {
                          try {
                            const res = await fetch(`/api/search-places?q=${encodeURIComponent(val)}`);
                            const data = await res.json();
                            setIsSearchingPlace(false);
                            if (data.items && Array.isArray(data.items)) {
                              setPlaceSuggestions(data.items as PlaceSuggestion[]);
                            } else {
                              setPlaceSuggestions([]);
                            }
                          } catch {
                            setIsSearchingPlace(false);
                            setPlaceSuggestions([]);
                          }
                        }, 400);
                      }}
                      className="w-full text-sm text-[#292929] border-none outline-none focus:ring-0 p-0 placeholder-zinc-400 bg-transparent"
                    />
                    {isSearchingPlace && (
                      <div className="w-4 h-4 border border-[#292929] border-t-transparent animate-spin shrink-0" />
                    )}
                  </div>

                  {/* Selected place address display */}
                  {customCoord && place && (
                    <div className="flex items-center gap-1.5 pl-9 mt-1">
                      <span className="font-mono text-[9px] text-[#292929] tracking-tight uppercase border border-[#292929] px-1 py-0.5">
                        COORDS / {customCoord.lat.toFixed(4)}, {customCoord.lng.toFixed(4)}
                      </span>
                    </div>
                  )}

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && placeSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#292929] z-50 overflow-hidden max-h-64 overflow-y-auto">
                      {placeSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setPlace(suggestion.title);
                            if (suggestion.lat && suggestion.lng) {
                              setCustomCoord({ lat: suggestion.lat, lng: suggestion.lng });
                            }
                            setPlaceSuggestions([]);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-zinc-100 transition-colors flex flex-col gap-0.5 border-b border-[#292929] last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#292929] truncate">{suggestion.title}</span>
                            {suggestion.category && (
                              <span className="text-[9px] text-white bg-[#292929] px-1.5 py-0.5 shrink-0 truncate max-w-[80px] font-mono uppercase tracking-wider">
                                {suggestion.category.split(">").pop()?.trim()}
                              </span>
                            )}
                          </div>
                          {suggestion.roadAddress && (
                            <span className="text-[10px] text-zinc-400 pl-0 truncate">{suggestion.roadAddress}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. 가격 설정 (Price) - Input Text with Numeric Keyboard */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-[#292929]">
                  <span className="text-xs font-mono font-medium tracking-[0.1em] uppercase text-[#292929]">PRICE (KRW)</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="5500"
                      value={price || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setPrice(val ? parseInt(val) : 0);
                      }}
                      className="w-24 text-right text-sm font-mono text-[#292929] border-none outline-none focus:ring-0 p-0 bg-transparent"
                    />
                    <span className="text-xs font-mono font-medium tracking-[0.1em] text-[#292929] uppercase">KRW</span>
                  </div>
                </div>

                {/* 3. 평가 점수 (Rating) */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-[#292929]">
                  <span className="text-xs font-mono font-medium tracking-[0.1em] uppercase text-[#292929]">RATING</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="transition-transform active:scale-95"
                      >
                        <span className={`font-mono text-sm ${star <= rating ? "text-[#292929] font-bold" : "text-zinc-300"}`}>
                          {star <= rating ? "★" : "☆"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. 크림 당도 & 질감 & 커피 베이스 (1 to 10 Button Check List) */}
                <div className="p-4 bg-zinc-50 flex flex-col gap-4 border-b border-[#292929]">
                  
                  {/* Sweetness (1-10 Buttons) */}
                  <div className="bg-white p-3 border border-[#292929] flex flex-col gap-2.5">
                    <div className="flex gap-1 overflow-x-auto py-1 no-scrollbar justify-between">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSweetness(num)}
                          className={`w-6 h-6 border ${
                            sweetness === num 
                              ? "bg-[#292929] border-[#292929] text-white" 
                              : "bg-white border-[#292929] text-[#292929] hover:bg-zinc-50"
                          } shrink-0 transition-all font-mono text-[9px] flex items-center justify-center`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono font-medium tracking-[0.1em] uppercase text-[#292929] px-0.5">
                      <span>LESS SWEET</span>
                      <span>MORE SWEET</span>
                    </div>
                  </div>

                  {/* Texture (1-10 Buttons) */}
                  <div className="bg-white p-3 border border-[#292929] flex flex-col gap-2.5">
                    <div className="flex gap-1 overflow-x-auto py-1 no-scrollbar justify-between">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setTexture(num)}
                          className={`w-6 h-6 border ${
                            texture === num 
                              ? "bg-[#292929] border-[#292929] text-white" 
                              : "bg-white border-[#292929] text-[#292929] hover:bg-zinc-50"
                          } shrink-0 transition-all font-mono text-[9px] flex items-center justify-center`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono font-medium tracking-[0.1em] uppercase text-[#292929] px-0.5">
                      <span>THIN</span>
                      <span>THICK</span>
                    </div>
                  </div>

                  {/* Coffee Taste (1-10 Buttons) */}
                  <div className="bg-white p-3 border border-[#292929] flex flex-col gap-2.5">
                    <div className="flex gap-1 overflow-x-auto py-1 no-scrollbar justify-between">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCoffeeTaste(num)}
                          className={`w-6 h-6 border ${
                            coffeeTaste === num 
                              ? "bg-[#292929] border-[#292929] text-white" 
                              : "bg-white border-[#292929] text-[#292929] hover:bg-zinc-50"
                          } shrink-0 transition-all font-mono text-[9px] flex items-center justify-center`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-mono font-medium tracking-[0.1em] uppercase text-[#292929] px-0.5">
                      <span>ACIDIC</span>
                      <span>NUTTY</span>
                    </div>
                  </div>

                </div>

                {/* 6. 맛 한줄평 (Notes) */}
                <div className="p-4 flex flex-col gap-2 border-b border-[#292929]">
                  <label className="text-[10px] font-mono font-medium tracking-[0.1em] uppercase text-[#292929]">NOTES</label>
                  <textarea
                    rows={2}
                    placeholder="ex) 크림에서 약간의 오렌지 향이 남"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs text-[#292929] border border-[#292929] rounded-none p-3 outline-none resize-none placeholder-zinc-400 focus:bg-zinc-50"
                  />
                </div>

              </div>
            </div>
            
            {/* Fixed Complete Button at Bottom */}
            <div className="p-4 bg-white border-t border-[#292929] shrink-0 z-10">
              <button
                type="button"
                onClick={handleAddRecord}
                disabled={!place.trim()}
                className={`w-full text-center text-xs font-mono font-medium tracking-[0.15em] py-4 uppercase border transition-all duration-150 ${
                  place.trim() 
                    ? "bg-white text-[#292929] border-[#292929] hover:bg-[#292929] hover:text-white cursor-pointer" 
                    : "bg-zinc-100 text-zinc-300 border-zinc-200 cursor-not-allowed"
                }`}
              >
                SUBMIT RECORD +
              </button>
            </div>
          </div>
        )}

        {/* MAP TAB */}
        {activeTab === "map" && (
          <div className="p-4 animate-fade-in flex flex-col gap-4">
            
            {/* 카페 선택됐을 때: 이미지 크게 → 카페 정보 → 지도 작게 */}
            {selectedMapCafe ? (
              <>
                {/* 1. 이미지 크게 */}
                <div className="w-full rounded-2xl overflow-hidden border border-[#E9E1D6] shadow-sm">
                  {selectedMapCafe.photo ? (
                    <div className="w-full aspect-square overflow-hidden">
                      <img src={selectedMapCafe.photo} alt={selectedMapCafe.place} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-gradient-to-br from-[#2A1A12] to-[#4A3222] flex items-center justify-center">
                      <Coffee className="w-12 h-12 text-[#FAF6F0]/20" />
                    </div>
                  )}
                </div>

                {/* 2. 카페 정보 */}
                <div className="bg-white border border-[#E9E1D6] rounded-2xl overflow-hidden shadow-md animate-slide-up">
                  <div className="p-4 flex flex-col gap-3">
                    {/* 카페 이름 + 별점 + 가격 */}
                    <div>
                      <h3 className="text-sm font-bold text-[#2A1A12]">{selectedMapCafe.place}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex items-center gap-0.5 text-amber-500 font-bold text-[11px]">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          <span>{selectedMapCafe.rating.toFixed(1)}</span>
                        </div>
                        <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
                        <span className="text-[10px] text-[#8B5A2B] font-mono">{selectedMapCafe.price.toLocaleString()}원</span>
                        {selectedMapCafe.distance && (
                          <span className="text-[10px] text-[#292929] font-mono">
                            {(selectedMapCafe.distance / 1000).toFixed(2)}km
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      {/* 크림 당도 */}
                      <div className="bg-white p-4 border border-[#292929] flex flex-col gap-2.5">
                        <div className="flex gap-1 justify-between">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-6 h-6 border ${
                                i === normalizeVal(selectedMapCafe.sweetness, selectedMapCafe.id) - 1
                                  ? "bg-[#292929] border-[#292929]"
                                  : "bg-white border-[#292929]"
                              } flex items-center justify-center font-mono text-[9px] ${i === normalizeVal(selectedMapCafe.sweetness, selectedMapCafe.id) - 1 ? "text-white" : "text-[#292929]"}`}
                            >
                              {i + 1}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] font-mono font-medium tracking-[0.1em] uppercase text-[#292929] px-0.5">
                          <span>LESS SWEET</span>
                          <span>MORE SWEET</span>
                        </div>
                      </div>

                      {/* 크림 질감 */}
                      <div className="bg-white p-4 border border-[#292929] flex flex-col gap-2.5">
                        <div className="flex gap-1 justify-between">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-6 h-6 border ${
                                i === normalizeVal(selectedMapCafe.texture, selectedMapCafe.id) - 1
                                  ? "bg-[#292929] border-[#292929]"
                                  : "bg-white border-[#292929]"
                              } flex items-center justify-center font-mono text-[9px] ${i === normalizeVal(selectedMapCafe.texture, selectedMapCafe.id) - 1 ? "text-white" : "text-[#292929]"}`}
                            >
                              {i + 1}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] font-mono font-medium tracking-[0.1em] uppercase text-[#292929] px-0.5">
                          <span>THIN</span>
                          <span>THICK</span>
                        </div>
                      </div>

                      {/* 커피 맛 */}
                      <div className="bg-white p-4 border border-[#292929] flex flex-col gap-2.5">
                        <div className="flex gap-1 justify-between">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-6 h-6 border ${
                                i === normalizeVal(selectedMapCafe.coffeeTaste, selectedMapCafe.id) - 1
                                  ? "bg-[#292929] border-[#292929]"
                                  : "bg-white border-[#292929]"
                              } flex items-center justify-center font-mono text-[9px] ${i === normalizeVal(selectedMapCafe.coffeeTaste, selectedMapCafe.id) - 1 ? "text-white" : "text-[#292929]"}`}
                            >
                              {i + 1}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-[10px] font-mono font-medium tracking-[0.1em] uppercase text-[#292929] px-0.5">
                          <span>ACIDIC</span>
                          <span>NUTTY</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#292929] bg-zinc-50 p-3 border border-[#292929] leading-relaxed">
                      {selectedMapCafe.notes}
                    </p>
                  </div>
                </div>

                {/* 3. 지도 작게 */}
                <div
                  ref={mapRef}
                  className="w-full bg-zinc-100 overflow-hidden border border-[#292929] select-none"
                  style={{ height: "180px" }}
                />
              </>
            ) : (
              /* 카페 미선택 시: 지도 크게 */
              <>
                <div
                  ref={mapRef}
                  className="w-full bg-[#ECE6DC] rounded-2xl overflow-hidden border border-[#E9E1D6] shadow-inner select-none"
                  style={{ height: "350px" }}
                />
                <div className="pb-4 pt-2 bg-gradient-to-t from-[#FDFBF7] to-transparent">
                  <button
                    onClick={() => setActiveTab("record")}
                    className="w-full bg-[#2A1A12] text-[#FAF6F0] text-sm font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 hover:bg-[#3A2A1A] active:scale-[0.98] transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    지도에서 기록하기
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* RANKING TAB */}
        {activeTab === "ranking" && (
          <div className="p-4 animate-fade-in flex flex-col gap-4">
            <div className="border-b border-[#292929] pb-3 flex justify-between items-end">
              <div>
                <span className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-[#292929] block mb-1">03 / RANKINGS</span>
                <h2 className="text-xl font-light tracking-[-0.02em] uppercase text-[#292929]">EINSPÄNNER TOP LIST</h2>
              </div>
              <button
                onClick={fetchCurrentLocation}
                className={`flex items-center gap-1.5 text-[9px] font-mono font-medium tracking-[0.1em] uppercase bg-white text-[#292929] hover:bg-[#292929] hover:text-white px-3 py-1.5 border border-[#292929] transition-all duration-150 ${isGettingLocation ? "animate-pulse" : ""}`}
              >
                <Navigation className="w-2.5 h-2.5" />
                <span>GPS UPDATE</span>
              </button>
            </div>

            {/* Filters Horizontal Chips */}
            <div className="flex gap-1 overflow-x-auto pb-1.5 no-scrollbar border-b border-[#292929]">
              <button
                onClick={() => setRankingFilter("rating")}
                className={`text-[9px] font-mono font-medium tracking-[0.1em] uppercase px-3 py-1.5 border shrink-0 transition-all duration-150 ${rankingFilter === "rating" ? "bg-[#292929] text-white border-[#292929]" : "bg-white text-[#292929] border-[#292929] hover:bg-zinc-50"}`}
              >
                RATING ★
              </button>
              <button
                onClick={() => setRankingFilter("cream-sweet")}
                className={`text-[9px] font-mono font-medium tracking-[0.1em] uppercase px-3 py-1.5 border shrink-0 transition-all duration-150 ${rankingFilter === "cream-sweet" ? "bg-[#292929] text-white border-[#292929]" : "bg-white text-[#292929] border-[#292929] hover:bg-zinc-50"}`}
              >
                SWEETNESS 🍯
              </button>
              <button
                onClick={() => setRankingFilter("cream-texture")}
                className={`text-[9px] font-mono font-medium tracking-[0.1em] uppercase px-3 py-1.5 border shrink-0 transition-all duration-150 ${rankingFilter === "cream-texture" ? "bg-[#292929] text-white border-[#292929]" : "bg-white text-[#292929] border-[#292929] hover:bg-zinc-50"}`}
              >
                TEXTURE 🍰
              </button>
              <button
                onClick={() => setRankingFilter("coffee-taste")}
                className={`text-[9px] font-mono font-medium tracking-[0.1em] uppercase px-3 py-1.5 border shrink-0 transition-all duration-150 ${rankingFilter === "coffee-taste" ? "bg-[#292929] text-white border-[#292929]" : "bg-white text-[#292929] border-[#292929] hover:bg-zinc-50"}`}
              >
                BASE TASTE ☕
              </button>
              <button
                onClick={() => setRankingFilter("price")}
                className={`text-[9px] font-mono font-medium tracking-[0.1em] uppercase px-3 py-1.5 border shrink-0 transition-all duration-150 ${rankingFilter === "price" ? "bg-[#292929] text-white border-[#292929]" : "bg-white text-[#292929] border-[#292929] hover:bg-zinc-50"}`}
              >
                LOWEST PRICE 💸
              </button>
              <button
                onClick={() => setRankingFilter("distance")}
                className={`text-[9px] font-mono font-medium tracking-[0.1em] uppercase px-3 py-1.5 border shrink-0 transition-all duration-150 ${rankingFilter === "distance" ? "bg-[#292929] text-white border-[#292929]" : "bg-white text-[#292929] border-[#292929] hover:bg-zinc-50"}`}
              >
                NEAREST 📍
              </button>
            </div>

            {/* Rankings List */}
            <div className="flex flex-col gap-4 mt-1">
              {getSortedRankings().map((cafe, index) => {
                const displayNum = String(index + 1).padStart(2, '0');
                return (
                  <div
                    key={cafe.id}
                    className="bg-white border border-[#292929] p-4 flex gap-4 relative"
                  >
                    {/* Index Rank Number */}
                    <div className="absolute top-4 left-4 w-6 h-6 border border-[#292929] bg-white flex items-center justify-center font-mono text-[10px] text-[#292929] font-bold z-10">
                      {displayNum}
                    </div>

                    <div className="pl-8 flex gap-4 w-full">
                      {/* Image Frame */}
                      <div className="w-16 h-16 bg-zinc-50 border border-[#292929] flex items-center justify-center overflow-hidden shrink-0">
                        {cafe.photo ? (
                          <img src={cafe.photo} alt={cafe.place} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-mono text-[8px] tracking-tight text-zinc-400">NO IMG</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-semibold text-[#292929] truncate uppercase tracking-tight">{cafe.place}</h4>
                            <span className="text-[10px] text-[#292929] font-mono shrink-0">
                              {cafe.price.toLocaleString()} KRW
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-[#292929] font-mono">★ {cafe.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-zinc-300">|</span>
                            <span className="text-[9px] text-[#292929] font-mono uppercase tracking-tight">
                              {rankingFilter === "cream-sweet" ? `SWEET: ${cafe.sweetness}/10` :
                                rankingFilter === "cream-texture" ? `THICK: ${cafe.texture}/10` :
                                  rankingFilter === "coffee-taste" ? `NUTTY: ${cafe.coffeeTaste}/10` :
                                    `SWT: ${cafe.sweetness} / TCK: ${cafe.texture}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#292929] border-dashed">
                          <span className="text-[9px] text-zinc-400 font-mono uppercase">
                            {cafe.distance ? `DIST / ${(cafe.distance / 1000).toFixed(2)} KM` : "DIST / UNKNOWN"}
                          </span>
                          <button
                            onClick={() => { setSelectedMapCafe(cafe); setActiveTab("map"); }}
                            className="text-[9px] text-[#292929] font-mono tracking-[0.1em] uppercase font-bold flex items-center hover:underline"
                          >
                            MAP VIEW →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
