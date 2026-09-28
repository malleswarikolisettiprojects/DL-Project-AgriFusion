const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
const missing = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lucideMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/m);
  const importedIcons = lucideMatch ? lucideMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  
  // Find JSX tags
  const matches = content.matchAll(/<([A-Z][a-zA-Z0-9]+)[\s/>]/g);
  for (const match of matches) {
    const tag = match[1];
    // standard lucide icons list
    const knownLucide = [
      'Activity','AlertCircle','AlertTriangle','ArrowRight','Award','Bug','Calendar','CheckCircle2',
      'ChevronDown','ChevronUp','Clock','CloudSun','Coins','Compass','DollarSign','Droplets','FileCheck',
      'FileSpreadsheet','FileText','Filter','History','Home','Info','LandPlot','Layers','Loader2','Lock',
      'LogIn','LogOut','MapPin','Menu','MessageSquareQuote','PanelLeftClose','PanelLeftOpen','Phone',
      'Plus','RefreshCw','RotateCcw','Shield','ShieldCheck','Sparkles','Sprout','Stethoscope','Sun',
      'Sunrise','Sunset','Timer','TrendingUp','User','UserCheck','UserPlus','Wheat','X'
    ];
    if (knownLucide.includes(tag) && !importedIcons.includes(tag)) {
      missing.push({ file, tag });
    }
  }
});

console.log('Missing Lucide Imports:', missing);
