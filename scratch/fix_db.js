const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixDbCoordinates() {
  console.log('Fetching records...');
  const { data: records, error } = await supabase.from('einspanner_records').select('*');
  if (error) {
    console.error('Error fetching records:', error);
    return;
  }

  console.log(`Found ${records.length} records. Checking for scale issues...`);

  for (const record of records) {
    let needsUpdate = false;
    let newLat = record.lat;
    let newLng = record.lng;

    if (record.lat > 90) {
      newLat = record.lat / 10;
      needsUpdate = true;
    }
    if (record.lng > 180) {
      newLng = record.lng / 10;
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log(`Fixing record [${record.place}] (${record.id}): lat: ${record.lat} -> ${newLat}, lng: ${record.lng} -> ${newLng}`);
      const { error: updateError } = await supabase
        .from('einspanner_records')
        .update({ lat: newLat, lng: newLng })
        .eq('id', record.id);
      
      if (updateError) {
        console.error(`Failed to update ${record.id}:`, updateError);
      } else {
        console.log(`Successfully updated ${record.id}`);
      }
    }
  }

  console.log('Done checking and fixing database records.');
}

fixDbCoordinates();
