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

// Real Seoul Einspanner cafe data with actual GPS coordinates
const INITIAL_CAFES: EinspannerRecord[] = [
  {
    id: "oats_yongsan",
    place: "오츠커피 용산점",
    photo: "",
    price: 5500,
    sweetness: 4,
    texture: 5,
    coffeeTaste: 4,
    notes: "서울 3대 아인슈페너 맛집! 꾸덕하고 묵직하게 올라간 크림 위에 귀여운 초코칩이 올라가요. 나무 스틱으로 크림을 먼저 퍼먹다가 나중에 섞어 마시는 걸 추천합니다. 서울 용산구 원효로89길 13-12.",
    rating: 4.8,
    lat: 37.5385,
    lng: 126.9658,
    createdAt: new Date().toISOString()
  },
  {
    id: "archivist_seochon",
    place: "아키비스트 서촌",
    photo: "",
    price: 7000,
    sweetness: 3,
    texture: 5,
    coffeeTaste: 4,
    notes: "서촌 고즈넉한 골목에 위치한 감성 카페. 쫀쫀하고 밀도 높은 크림으로 정평이 나 있으며 평일에도 웨이팅이 있을 만큼 인기. 서울 종로구 효자로13길 52.",
    rating: 4.7,
    lat: 37.5818,
    lng: 126.9734,
    createdAt: new Date().toISOString()
  },
  {
    id: "taeyang_bangbae",
    place: "태양커피 방배",
    photo: "",
    price: 6500,
    sweetness: 2,
    texture: 4,
    coffeeTaste: 5,
    notes: "아메리카노·카페라떼·콜드브루 중 베이스를 고를 수 있어 내 취향에 맞는 아인슈페너를 즐길 수 있어요. 쌉싸름한 커피 베이스와 달지 않은 크림의 균형이 매력. 서울 서초구 방배동.",
    rating: 4.6,
    lat: 37.4813,
    lng: 126.9830,
    createdAt: new Date().toISOString()
  },
  {
    id: "dongkyung_independence",
    place: "커피가게동경 독립문점",
    photo: "",
    price: 6000,
    sweetness: 3,
    texture: 4,
    coffeeTaste: 5,
    notes: "묵직한 바디감의 핸드드립 베이스 아인슈페너로 유명한 곳. 기존 망원점이 독립문 인근으로 이전. 커피 본연의 깊은 향과 꾸덕한 크림이 잘 어우러집니다. 서울 종로구 통일로12길 16-1.",
    rating: 4.5,
    lat: 37.5746,
    lng: 126.9583,
    createdAt: new Date().toISOString()
  }
];

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
        .select('*');

      if (fetchError) throw fetchError;

      // 2. Identify records that exist locally but not in DB, and insert them
      const dbIds = new Set((dbRecords || []).map(r => r.id));
      const userRecords = localRecords.filter(r => r.id.startsWith("user_"));
      const recordsToInsert = userRecords.filter(r => !dbIds.has(r.id));

      if (recordsToInsert.length > 0) {
        const formatted = recordsToInsert.map(r => ({
          id: r.id,
          place: r.place,
          photo: r.photo,
          price: r.price,
          sweetness: r.sweetness,
          texture: r.texture,
          coffee_taste: r.coffeeTaste,
          notes: r.notes,
          rating: r.rating,
          lat: r.lat,
          lng: r.lng,
          created_at: r.createdAt
        }));

        const { error: insertError } = await supabase
          .from('einspanner_records')
          .insert(formatted);

        if (insertError) throw insertError;
      }

      // 3. Get updated records from DB and merge
      const { data: updatedDbRecords, error: refetchError } = await supabase
        .from('einspanner_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (refetchError) throw refetchError;

      const mergedMap = new Map<string, EinspannerRecord>();
      
      // Seed with initial default cafes first
      INITIAL_CAFES.forEach(c => mergedMap.set(c.id, c));

      // Add local state user records
      userRecords.forEach(c => mergedMap.set(c.id, c));

      // Overwrite/merge with DB records
      if (updatedDbRecords) {
        updatedDbRecords.forEach(db => {
          mergedMap.set(db.id, {
            id: db.id,
            place: db.place,
            photo: db.photo || "",
            price: db.price,
            sweetness: db.sweetness,
            texture: db.texture,
            coffeeTaste: db.coffee_taste,
            notes: db.notes || "",
            rating: db.rating,
            lat: db.lat,
            lng: db.lng,
            createdAt: db.created_at
          });
        });
      }

      const mergedList = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setRecords(mergedList);
      localStorage.setItem("einspanner_records", JSON.stringify(mergedList));
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
      new naver.maps.Marker({
        position: new naver.maps.LatLng(cafe.lat, cafe.lng),
        map: map,
        icon: {
          content: `
            <div class="w-5 h-5 bg-[#8B5A2B] rounded-full border border-white shadow flex items-center justify-center">
              <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>
            </div>
          `,
          anchor: new naver.maps.Point(10, 10)
        }
      });
    });

  }, [activeTab, userLocation, records, naverMapLoaded]);

  // Initialize Naver Map for Map Tab (Full Screen Map)
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).naver || !(window as any).naver.maps || !mapRef.current || activeTab !== "map") return;

    const naver = (window as any).naver;
    const center = new naver.maps.LatLng(userLocation.lat, userLocation.lng);

    const map = new naver.maps.Map(mapRef.current, {
      center: center,
      zoom: 13,
      zoomControl: true,
      zoomControlOptions: {
        position: naver.maps.Position.RIGHT_BOTTOM
      }
    });

    setMapInstance(map);

    // User Location Marker
    new naver.maps.Marker({
      position: center,
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
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(cafe.lat, cafe.lng),
        map: map,
        title: cafe.place,
        icon: {
          content: `
            <div class="relative flex items-center justify-center group cursor-pointer">
              <div class="w-7 h-7 bg-[#8B5A2B] rounded-full border-2 border-white shadow-md flex items-center justify-center hover:scale-110 transition-transform">
                <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>
              </div>
            </div>
          `,
          anchor: new naver.maps.Point(14, 14)
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
            <div class="flex flex-col items-center animate-bounce">
              <div class="bg-[#2A1A12] text-white text-[9px] font-bold py-1 px-2 rounded-full whitespace-nowrap shadow-md border border-white mb-0.5">
                여기에 기록하기 +
              </div>
              <div class="w-6 h-6 bg-[#C08C5D] rounded-full border-2 border-white shadow flex items-center justify-center">
                <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
            </div>
          `,
          anchor: new naver.maps.Point(35, 45)
        }
      });

      naver.maps.Event.addListener(tempMarker, "click", () => {
        setCustomCoord({ lat: clickedLat, lng: clickedLng });
        setActiveTab("record");
      });
    });

  }, [activeTab, userLocation, records, naverMapLoaded]);

  // Sorting logic for rankings
  const getSortedRankings = () => {
    const list = [...enhancedRecords];
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
    <div className="flex flex-col w-full min-h-screen bg-[#FDFBF7] font-sans relative">
      {/* Splash Screen */}
      {showSplash && (
        <div className="absolute inset-0 bg-[#2A1A12] z-50 flex flex-col items-center justify-center animate-splash p-6 text-center">
          <div className="flex flex-col items-center gap-6">
            {/* 2D Graphic side-view of an Einspanner Glass */}
            <div className="animate-coffee">
              <svg className="w-32 h-40 drop-shadow-xl" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Glass Cup Outline */}
                <path d="M20 30 L30 130 C31 140, 40 148, 50 148 L70 148 C80 148, 89 140, 90 130 L100 30" fill="none" stroke="#E9E1D6" strokeWidth="2.5" opacity="0.35" />

                {/* Coffee Layer (Bottom) */}
                <path d="M26 90 L30 130 C31 135, 36 140, 42 140 L78 140 C84 140, 89 135, 90 130 L94 90 Z" fill="#2A1A12" />

                {/* Gradient blending zone (Espresso mixing with cream) */}
                <path d="M26 80 L94 80 L94 92 L26 92 Z" fill="url(#coffee-blend)" />

                {/* Coffee top curve */}
                <path d="M24 70 L96 70 L94 81 L26 81 Z" fill="#4A3222" />

                {/* Thick Cream Layer (Top) */}
                <path d="M16 28 C16 28, 25 15, 45 18 C50 12, 70 10, 80 20 C90 15, 104 28, 104 28 L98 72 L22 72 Z" fill="#FAF6F0" />

                {/* Cream highlight details */}
                <path d="M30 40 C45 35, 60 38, 75 32" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                <path d="M40 55 C55 50, 70 52, 85 46" stroke="#E9E1D6" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

                {/* Cocoa Powder Dusting on top */}
                <circle cx="48" cy="18" r="2.5" fill="#5C3A21" />
                <circle cx="56" cy="15" r="2" fill="#8B5A2B" />
                <circle cx="68" cy="16" r="3" fill="#5C3A21" />
                <circle cx="78" cy="22" r="2" fill="#8B5A2B" />
                <circle cx="38" cy="24" r="2" fill="#5C3A21" />
                <circle cx="85" cy="26" r="1.5" fill="#8B5A2B" />

                {/* Glass Cup reflection lines */}
                <path d="M21 35 L29 115" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                <path d="M99 35 L93 115" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />

                {/* Glass Rim Highlight */}
                <path d="M19 30 C19 30, 60 25, 101 30" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.4" />

                <defs>
                  <linearGradient id="coffee-blend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4A3222" />
                    <stop offset="50%" stopColor="#8B5A2B" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#2A1A12" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-[#C08C5D] font-mono text-sm tracking-wider uppercase">Einspänner Archiving App</h2>
              <h1 className="text-[#FAF6F0] text-2xl font-bold tracking-tight px-4 leading-relaxed">
                세상에서 가장 맛있는<br />아인슈페너를 찾아서
              </h1>
            </div>

            <div className="w-16 h-1 bg-[#C08C5D] rounded mt-4 animate-pulse-slow"></div>
          </div>
        </div>
      )}

      {/* Centered Transparent Title Header */}
      <header className="sticky top-0 bg-[#FDFBF7]/90 backdrop-blur-md text-[#1E110B] px-4 py-4 flex items-center justify-center border-b border-[#E9E1D6]/40 z-30 min-h-[50px]">
        {activeTab !== "home" && activeTab !== "record" && (
          <button
            onClick={() => { setActiveTab("home"); setSelectedMapCafe(null); }}
            className="absolute left-4 p-2 hover:bg-[#FAF6F0] rounded-full transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-[#8B5A2B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {activeTab === "home" && (
          <div className="w-full flex items-center justify-between gap-3 px-2">
            {/* Sleek Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#8B5A2B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="카페 이름 또는 노트 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FAF6F0] text-xs text-[#2A1A12] pl-8 pr-3 py-2 rounded-full border border-[#E9E1D6] focus:outline-none focus:border-[#8B5A2B] placeholder-[#A59586]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200 rounded-full"
                >
                  <X className="w-3 h-3 text-[#8B5A2B]" />
                </button>
              )}
            </div>

            {/* Sync Button */}
            <button
              onClick={() => syncWithSupabase(records)}
              disabled={isSyncing}
              className={`p-2 hover:bg-[#FAF6F0] rounded-full transition-all text-[#8B5A2B] flex items-center gap-1 border border-[#E9E1D6]/40 shrink-0 ${isSyncing ? "opacity-60 cursor-not-allowed" : ""}`}
              title="데이터 동기화"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="text-[9px] font-bold">동기화</span>
            </button>
          </div>
        )}
        {(activeTab === "map" || activeTab === "ranking") && (
          <button
            onClick={() => { setActiveTab("home"); setSelectedMapCafe(null); }}
            className="absolute right-4 text-xs font-bold text-[#8B5A2B] hover:bg-[#FAF6F0] px-3 py-1.5 rounded-lg transition-colors"
          >
            완료
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-8 overflow-y-auto">
        {/* HOME TAB (Main stacked sections: 기록하기 -> 랭킹 -> 지도) */}
        {activeTab === "home" && (
          <div className="flex flex-col gap-6 p-4 animate-fade-in">
            {/* 1. 지도 섹션 (내위치 기반) */}
            <div className="bg-white border border-[#E9E1D6] rounded-2xl p-4 shadow-sm flex flex-col gap-3 stagger-item delay-1">
              <div className="flex justify-between items-center border-b border-[#FAF6F0] pb-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#8B5A2B]" />
                  <h3 className="text-xs font-extrabold text-[#2A1A12]">내 위치 기반 지도</h3>
                </div>
                <button
                  onClick={() => setActiveTab("map")}
                  className="text-[10px] text-[#C08C5D] flex items-center hover:underline"
                >
                  크게 보기 <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Naver Map Preview Container */}
              <div
                ref={homeMapRef}
                className="w-full aspect-video bg-[#ECE6DC] rounded-xl overflow-hidden border border-[#E9E1D6] shadow-inner"
                style={{ height: "200px" }}
              ></div>
            </div>

            {/* 2. 기록하기 Card Button */}
            <div 
              onClick={() => {
                setActiveTab("record");
                // Small timeout to allow activeTab tab switch to mount/render input before triggering click
                setTimeout(() => {
                  fileInputRef.current?.click();
                }, 50);
              }}
              className="cursor-pointer relative overflow-hidden bg-[#2A1A12] border border-[#E9E1D6]/20 rounded-2xl py-6 px-8 text-white shadow-md active:scale-98 flex flex-row items-center justify-center gap-8 stagger-item delay-2 cta-hover"
            >
              {/* Left Side: 2D Graphic (Splash SVG) */}
              <div className="flex items-center justify-center shrink-0">
                <svg className="w-24 h-32 drop-shadow-xl" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Glass Cup Outline */}
                  <path d="M20 30 L30 130 C31 140, 40 148, 50 148 L70 148 C80 148, 89 140, 90 130 L100 30" fill="none" stroke="#E9E1D6" strokeWidth="2.5" opacity="0.35" />

                  {/* Coffee Layer (Bottom) */}
                  <path d="M26 90 L30 130 C31 135, 36 140, 42 140 L78 140 C84 140, 89 135, 90 130 L94 90 Z" fill="#2A1A12" />

                  {/* Gradient blending zone (Espresso mixing with cream) */}
                  <path d="M26 80 L94 80 L94 92 L26 92 Z" fill="url(#coffee-blend-btn)" />

                  {/* Coffee top curve */}
                  <path d="M24 70 L96 70 L94 81 L26 81 Z" fill="#4A3222" />

                  {/* Thick Cream Layer (Top) */}
                  <path d="M16 28 C16 28, 25 15, 45 18 C50 12, 70 10, 80 20 C90 15, 104 28, 104 28 L98 72 L22 72 Z" fill="#FAF6F0" />

                  {/* Cream highlight details */}
                  <path d="M30 40 C45 35, 60 38, 75 32" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                  <path d="M40 55 C55 50, 70 52, 85 46" stroke="#E9E1D6" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

                  {/* Cocoa Powder Dusting on top */}
                  <circle cx="48" cy="18" r="2.5" fill="#5C3A21" />
                  <circle cx="56" cy="15" r="2" fill="#8B5A2B" />
                  <circle cx="68" cy="16" r="3" fill="#5C3A21" />
                  <circle cx="78" cy="22" r="2" fill="#8B5A2B" />
                  <circle cx="38" cy="24" r="2" fill="#5C3A21" />
                  <circle cx="85" cy="26" r="1.5" fill="#8B5A2B" />

                  {/* Glass Cup reflection lines */}
                  <path d="M21 35 L29 115" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                  <path d="M99 35 L93 115" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />

                  {/* Glass Rim Highlight */}
                  <path d="M19 30 C19 30, 60 25, 101 30" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.4" />

                  <defs>
                    <linearGradient id="coffee-blend-btn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4A3222" />
                      <stop offset="50%" stopColor="#8B5A2B" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#2A1A12" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Right Side: Text in two lines */}
              <div className="flex flex-col items-start text-left">
                <span className="text-[28px] font-bold tracking-tight text-[#FAF6F0] leading-tight">아인슈페너</span>
                <span className="text-[28px] font-bold tracking-tight text-[#FAF6F0] leading-tight">기록하기</span>
              </div>
            </div>

            {/* 3. 랜덤 추천 섹션 (좌우 슬라이드) */}
            <div className="bg-white border border-[#E9E1D6] rounded-2xl p-4 shadow-sm flex flex-col gap-3 stagger-item delay-3">
              <div className="flex justify-between items-center border-b border-[#FAF6F0] pb-2">
                <div className="flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-[#8B5A2B]" />
                  <h3 className="text-xs font-extrabold text-[#2A1A12]">오늘의 추천 아인슈페너</h3>
                </div>
                <button
                  onClick={() => setActiveTab("ranking")}
                  className="text-[10px] text-[#C08C5D] flex items-center hover:underline"
                >
                  더보기 <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* 좌우 슬라이드 리스트 */}
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar">
                {randomCafes.map((cafe) => (
                  <div
                    key={cafe.id}
                    onClick={() => { setSelectedMapCafe(cafe); setActiveTab("map"); }}
                    className="w-[200px] shrink-0 snap-start bg-[#FAF6F0]/40 rounded-xl border border-[#E9E1D6]/60 overflow-hidden shadow-xs hover:border-[#C08C5D] transition-all cursor-pointer flex flex-col"
                  >
                    {/* 이미지 영역 */}
                    <div className="w-full aspect-square bg-[#FAF6F0] border-b border-[#E9E1D6]/40 flex items-center justify-center overflow-hidden relative">
                      {cafe.photo ? (
                        <img src={cafe.photo} alt={cafe.place} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#2A1A12] to-[#4A3222] flex items-center justify-center">
                          <Coffee className="w-10 h-10 text-[#FAF6F0]/20" />
                        </div>
                      )}
                    </div>

                    {/* 정보 영역 (이름, 가격, 별점만 표시) */}
                    <div className="p-3 flex flex-col gap-1.5 justify-between flex-1">
                      <h4 className="text-xs font-extrabold text-[#2A1A12] truncate">{cafe.place}</h4>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[10px] text-[#8B5A2B] font-mono font-bold">{cafe.price.toLocaleString()}원</span>
                        <div className="flex items-center gap-0.5 text-amber-500 font-bold text-[10px]">
                          <Star className="w-3 h-3 fill-amber-500" />
                          <span>{cafe.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 검색 결과 표시 (검색어가 있을 경우) */}
            {searchQuery.trim() && (
              <div className="bg-white border border-[#E9E1D6] rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="border-b border-[#FAF6F0] pb-2">
                  <h3 className="text-xs font-extrabold text-[#2A1A12]">검색 결과 ({filteredRecords.length})</h3>
                </div>
                {filteredRecords.length > 0 ? (
                  <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                    {filteredRecords.map((cafe) => (
                      <div
                        key={cafe.id}
                        onClick={() => { setSelectedMapCafe(cafe); setActiveTab("map"); }}
                        className="flex items-center gap-3 p-2 hover:bg-[#FAF6F0] rounded-xl border border-transparent hover:border-[#E9E1D6] transition-colors cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-lg bg-[#FAF6F0] border border-[#E9E1D6]/40 flex items-center justify-center overflow-hidden shrink-0">
                          {cafe.photo ? (
                            <img src={cafe.photo} alt={cafe.place} className="w-full h-full object-cover" />
                          ) : (
                            <Coffee className="w-5 h-5 text-[#C08C5D]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-[#2A1A12] truncate">{cafe.place}</h4>
                          <p className="text-[9px] text-[#8B5A2B] font-mono mt-0.5">{cafe.price.toLocaleString()}원</p>
                        </div>
                        <div className="flex items-center gap-0.5 text-amber-500 font-bold text-[10px] shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          <span>{cafe.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#A59586] text-center py-4">일치하는 카페가 없습니다.</p>
                )}
              </div>
            )}
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
                      className="w-full text-xs font-bold text-zinc-900 border-none outline-none focus:ring-0 p-0 placeholder-zinc-400 bg-transparent"
                    />
                    {isSearchingPlace && (
                      <div className="w-4 h-4 border-2 border-[#C08C5D] border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                  </div>

                  {/* Selected place address display */}
                  {customCoord && place && (
                    <div className="flex items-center gap-1 pl-10 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#8B5A2B] shrink-0" />
                      <span className="text-[10px] text-[#8B5A2B] font-medium">
                        위치 선택됨 ({customCoord.lat.toFixed(4)}, {customCoord.lng.toFixed(4)})
                      </span>
                    </div>
                  )}

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && placeSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
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
                          className="w-full text-left px-4 py-3 hover:bg-[#FAF6F0] transition-colors flex flex-col gap-0.5 border-b border-zinc-50 last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-[#8B5A2B] shrink-0" />
                            <span className="text-xs font-bold text-zinc-900 truncate">{suggestion.title}</span>
                            {suggestion.category && (
                              <span className="text-[9px] text-[#8B5A2B] bg-[#FAF6F0] border border-[#E9E1D6] px-1.5 py-0.5 rounded-full shrink-0 truncate max-w-[80px]">
                                {suggestion.category.split(">").pop()?.trim()}
                              </span>
                            )}
                          </div>
                          {suggestion.roadAddress && (
                            <span className="text-[10px] text-zinc-400 pl-5 truncate">{suggestion.roadAddress}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. 가격 설정 (Price) - Input Text with Numeric Keyboard */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100">
                  <span className="text-xs font-bold text-zinc-800">가격 설정</span>
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
                      className="w-24 text-right text-xs font-mono font-bold text-zinc-900 border-none outline-none focus:ring-0 p-0 bg-transparent"
                    />
                    <span className="text-xs font-bold text-zinc-500">원</span>
                  </div>
                </div>

                {/* 3. 평가 점수 (Rating) */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100">
                  <span className="text-xs font-bold text-zinc-800">평가 점수</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="hover:scale-105 transition-transform"
                      >
                        <Star 
                          className={`w-5 h-5 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-200"}`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. 크림 당도 & 질감 & 커피 베이스 (1 to 10 Button Check List) */}
                <div className="p-4 bg-zinc-50 flex flex-col gap-4 border-b border-zinc-100">
                  
                  {/* Sweetness (1-10 Buttons without numbers) */}
                  <div className="bg-white p-3 rounded-xl border border-zinc-100 flex flex-col gap-2">
                    <div className="flex gap-1.5 overflow-x-auto py-1 no-scrollbar justify-between">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSweetness(num)}
                          className={`w-7 h-7 rounded-full transition-all border shrink-0 ${sweetness === num ? "bg-[#8B5A2B] border-[#8B5A2B]" : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs font-bold text-zinc-700 px-1 mt-1">
                      <span>덜 단 크림</span>
                      <span>단 크림</span>
                    </div>
                  </div>

                  {/* Texture (1-10 Buttons without numbers) */}
                  <div className="bg-white p-3 rounded-xl border border-zinc-100 flex flex-col gap-2">
                    <div className="flex gap-1.5 overflow-x-auto py-1 no-scrollbar justify-between">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setTexture(num)}
                          className={`w-7 h-7 rounded-full transition-all border shrink-0 ${texture === num ? "bg-[#8B5A2B] border-[#8B5A2B]" : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs font-bold text-zinc-700 px-1 mt-1">
                      <span>묽음</span>
                      <span>꾸덕함</span>
                    </div>
                  </div>

                  {/* Coffee Taste (1-10 Buttons without numbers) */}
                  <div className="bg-white p-3 rounded-xl border border-[#E9E1D6]/30 flex flex-col gap-2">
                    <div className="flex gap-1.5 overflow-x-auto py-1 no-scrollbar justify-between">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setCoffeeTaste(num)}
                          className={`w-7 h-7 rounded-full transition-all border shrink-0 ${coffeeTaste === num ? "bg-[#8B5A2B] border-[#8B5A2B]" : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"}`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs font-bold text-zinc-700 px-1 mt-1">
                      <span>산미</span>
                      <span>고소</span>
                    </div>
                  </div>

                </div>

                {/* 6. 맛 한줄평 (Notes) */}
                <div className="p-4 flex flex-col gap-1.5 border-b border-zinc-100">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">한줄평</label>
                  <textarea
                    rows={2}
                    placeholder="ex) 크림에서 약간의 오렌지 향이 남"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs text-zinc-600 border border-zinc-100 rounded-xl p-2.5 outline-none resize-none placeholder-zinc-400"
                  />
                </div>

              </div>
            </div>
            
            {/* Fixed Complete Button at Bottom */}
            <div className="p-4 bg-white border-t border-zinc-100 shrink-0 z-10">
              <button
                type="button"
                onClick={handleAddRecord}
                disabled={!place.trim()}
                className={`w-full text-center text-xs font-bold py-3.5 rounded-xl shadow-xs transition-colors ${place.trim() ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-300 cursor-not-allowed"}`}
              >
                완료
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
                          <>
                            <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
                            <span className="text-[9px] text-blue-500 font-bold">
                              {(selectedMapCafe.distance / 1000).toFixed(2)}km
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* 크림 당도 */}
                      <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#E9E1D6] flex flex-col gap-2.5">
                        <div className="flex gap-1.5 justify-between">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-7 h-7 rounded-full border ${
                                i === normalizeVal(selectedMapCafe.sweetness, selectedMapCafe.id) - 1
                                  ? "bg-[#8B5A2B] border-[#8B5A2B]"
                                  : "bg-white border-zinc-200"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-xs font-bold text-zinc-700 px-1">
                          <span>덜 단 크림</span>
                          <span>단 크림</span>
                        </div>
                      </div>

                      {/* 크림 질감 */}
                      <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#E9E1D6] flex flex-col gap-2.5">
                        <div className="flex gap-1.5 justify-between">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-7 h-7 rounded-full border ${
                                i === normalizeVal(selectedMapCafe.texture, selectedMapCafe.id) - 1
                                  ? "bg-[#8B5A2B] border-[#8B5A2B]"
                                  : "bg-white border-zinc-200"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-xs font-bold text-zinc-700 px-1">
                          <span>묽음</span>
                          <span>꾸덕함</span>
                        </div>
                      </div>

                      {/* 커피 맛 */}
                      <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#E9E1D6] flex flex-col gap-2.5">
                        <div className="flex gap-1.5 justify-between">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-7 h-7 rounded-full border ${
                                i === normalizeVal(selectedMapCafe.coffeeTaste, selectedMapCafe.id) - 1
                                  ? "bg-[#8B5A2B] border-[#8B5A2B]"
                                  : "bg-white border-zinc-200"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-xs font-bold text-zinc-700 px-1">
                          <span>산미</span>
                          <span>고소</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-[#7A6A5E] bg-zinc-50 p-2.5 rounded-lg border border-[#F0E6D8] leading-relaxed">
                      {selectedMapCafe.notes}
                    </p>
                  </div>
                </div>

                {/* 3. 지도 작게 */}
                <div
                  ref={mapRef}
                  className="w-full bg-[#ECE6DC] rounded-2xl overflow-hidden border border-[#E9E1D6] shadow-inner select-none"
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
            <div className="border-b border-[#E9E1D6] pb-2 flex justify-between items-end">
              <div>
                <h2 className="text-xs font-bold text-[#2A1A12]">아인슈페너 맛집 랭킹</h2>
                <p className="text-[9px] text-[#8B5A2B]">내 취향 필터별 순위를 바로 확인해 보세요.</p>
              </div>
              <button
                onClick={fetchCurrentLocation}
                className={`flex items-center gap-1 text-[9px] bg-[#4A3525] text-[#FAF6F0] px-2 py-1 rounded-full border border-[#5C4535] transition-all hover:bg-[#5C4535] active:scale-95 ${isGettingLocation ? "animate-pulse" : ""}`}
              >
                <Navigation className="w-2.5 h-2.5 text-[#C08C5D] fill-[#C08C5D]" />
                <span>내위치 갱신</span>
              </button>
            </div>

            {/* Filters Horizontal Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setRankingFilter("rating")}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 transition-colors border ${rankingFilter === "rating" ? "bg-[#2A1A12] text-[#FAF6F0] border-[#2A1A12]" : "bg-white text-[#8B5A2B] border-[#E9E1D6] hover:bg-[#FAF6F0]"}`}
              >
                전체 평점 순 ⭐
              </button>
              <button
                onClick={() => setRankingFilter("cream-sweet")}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 transition-colors border ${rankingFilter === "cream-sweet" ? "bg-[#2A1A12] text-[#FAF6F0] border-[#2A1A12]" : "bg-white text-[#8B5A2B] border-[#E9E1D6] hover:bg-[#FAF6F0]"}`}
              >
                크림 달달 순 🍯
              </button>
              <button
                onClick={() => setRankingFilter("cream-texture")}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 transition-colors border ${rankingFilter === "cream-texture" ? "bg-[#2A1A12] text-[#FAF6F0] border-[#2A1A12]" : "bg-white text-[#8B5A2B] border-[#E9E1D6] hover:bg-[#FAF6F0]"}`}
              >
                크림 꾸덕 순 🍰
              </button>
              <button
                onClick={() => setRankingFilter("coffee-taste")}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 transition-colors border ${rankingFilter === "coffee-taste" ? "bg-[#2A1A12] text-[#FAF6F0] border-[#2A1A12]" : "bg-white text-[#8B5A2B] border-[#E9E1D6] hover:bg-[#FAF6F0]"}`}
              >
                고소한 커피 순 ☕
              </button>
              <button
                onClick={() => setRankingFilter("price")}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 transition-colors border ${rankingFilter === "price" ? "bg-[#2A1A12] text-[#FAF6F0] border-[#2A1A12]" : "bg-white text-[#8B5A2B] border-[#E9E1D6] hover:bg-[#FAF6F0]"}`}
              >
                가성비(최저가) 순 💸
              </button>
              <button
                onClick={() => setRankingFilter("distance")}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 transition-colors border ${rankingFilter === "distance" ? "bg-[#2A1A12] text-[#FAF6F0] border-[#2A1A12]" : "bg-white text-[#8B5A2B] border-[#E9E1D6] hover:bg-[#FAF6F0]"}`}
              >
                가까운 순 📍
              </button>
            </div>

            {/* Rankings List */}
            <div className="flex flex-col gap-3 mt-1">
              {getSortedRankings().map((cafe, index) => {
                const isTopThree = index < 3;
                const medalColors = ["bg-amber-400 text-white font-black", "bg-zinc-400 text-white font-black", "bg-amber-700 text-white font-black"];

                return (
                  <div
                    key={cafe.id}
                    className={`bg-white border border-[#E9E1D6] rounded-2xl p-4 flex gap-3 shadow-xs hover:border-[#C08C5D] transition-colors relative ${isTopThree ? "ring-1 ring-amber-500/10" : ""}`}
                  >
                    <div className={`absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${isTopThree ? medalColors[index] : "bg-zinc-100 text-[#8B5A2B] font-bold"}`}>
                      {index + 1}
                    </div>

                    <div className="pl-6 flex gap-3 w-full">
                      <div className="w-16 h-16 rounded-xl bg-[#FAF6F0] border border-[#E9E1D6] flex items-center justify-center overflow-hidden shrink-0">
                        {cafe.photo ? (
                          <img src={cafe.photo} alt={cafe.place} className="w-full h-full object-cover" />
                        ) : (
                          <Coffee className="w-7 h-7 text-[#C08C5D]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs font-bold text-[#2A1A12] truncate">{cafe.place}</h4>
                            <span className="text-[9px] text-[#A59586] font-mono shrink-0">
                              {cafe.price.toLocaleString()}원
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex items-center gap-0.5 text-amber-500 font-bold text-[10px]">
                              <Star className="w-3 h-3 fill-amber-500" />
                              <span>{cafe.rating.toFixed(1)}</span>
                            </div>
                            <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>
                            <span className="text-[9px] text-[#8B5A2B]">
                              {rankingFilter === "cream-sweet" ? `당도 ${cafe.sweetness}/5` :
                                rankingFilter === "cream-texture" ? `질감 ${cafe.texture}/5` :
                                  rankingFilter === "coffee-taste" ? `고소함 ${cafe.coffeeTaste}/5` :
                                    `달달 ${cafe.sweetness} • 꾸덕 ${cafe.texture}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-dashed border-[#FAF6F0]">
                          <span className="text-[8px] text-zinc-400">
                            {cafe.distance ? `내 위치에서 ${(cafe.distance / 1000).toFixed(2)}km` : "거리 측정 불가"}
                          </span>
                          <button
                            onClick={() => { setSelectedMapCafe(cafe); setActiveTab("map"); }}
                            className="text-[9px] text-[#C08C5D] font-bold flex items-center hover:underline"
                          >
                            지도 <ChevronRight className="w-3.5 h-3.5" />
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
