import type { Metadata } from 'next';
import { Page } from '@/components/ui/Page';

export const metadata: Metadata = { title: 'Credits' };

const LICENCES: Record<string, string> = {
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
};

const CITY_PHOTOS = [
  { city: 'Amsterdam', title: 'Colorful Amsterdam', artist: 'Radek Kucharski', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Colorful_Amsterdam_-_Flickr_-_radkuch.13.jpg' },
  { city: 'Berlin', title: 'Brandenburger Tor nachts', artist: 'Thomas Wolf, www.foto-tw.de', license: 'CC BY-SA 3.0', page: 'https://commons.wikimedia.org/wiki/File:Brandenburger_Tor_nachts.jpg' },
  { city: 'Paris', title: 'Eiffel Tower lights at dusk', artist: 'Eutouring', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Eiffel_Tower_lights_at_dusk.jpg' },
  { city: 'Lisbon', title: 'Alfama, Lisbon, Portugal July 2021, Tram', artist: 'Sharon Hahn Darlin', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Alfama,_Lisbon,_Portugal_July_2021_-_Tram.jpg' },
  { city: 'Barcelona', title: 'Sagrada Familia Barcelona 2', artist: 'kallerna', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Sagrada_Familia_Barcelona_2.jpg' },
  { city: 'Prague', title: 'Prague skyline at dawn', artist: 'Petar Milošević', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Prague_skyline_at_dawn.jpg' },
  { city: 'Vienna', title: 'Wien katedra sw Szczepana widok z wiezy 6', artist: 'Andrzej Otrębski', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Wien_katedra_sw_Szczepana_widok_z_wiezy_6.jpg' },
  { city: 'Rome', title: 'Colosseum of Rome, Italy', artist: 'Wilfredor', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Colosseum_of_Rome,_Italy.jpg' },
];

export default function CreditsPage() {
  return (
    <Page>
      <main className="simple-page narrow prose">
        <h1 className="page-title">Credits</h1>
        <h2 className="section-title">Opening video</h2>
        <p>Barbell training clip from <a className="link" href="https://mixkit.co/free-stock-video/a-shirtless-young-man-does-repetitions-lifting-the-heavy-barbell-52094/" target="_blank" rel="noopener noreferrer">Mixkit</a>, under the Mixkit Stock Video Free License. Trimmed and cropped.</p>
        <h2 className="section-title">City photos</h2>
        <p>From Wikimedia Commons. Each one is resized and shown with a dark overlay in the app. Changed versions of CC BY-SA photos are shared under the same licence.</p>
        <ul>
          {CITY_PHOTOS.map((p) => (
            <li key={p.city}><strong>{p.city}:</strong> <a className="link" href={p.page} target="_blank" rel="noopener noreferrer">{p.title}</a>, {p.artist}, <a className="link" href={LICENCES[p.license]} target="_blank" rel="noopener noreferrer">{p.license}</a></li>
          ))}
        </ul>
        <h2 className="section-title">Gym and athlete photos</h2>
        <p>Free stock photography from Unsplash, under the <a className="link" href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">Unsplash License</a>. The athletes on Home and the login screen are cut out of those photos and turned black and white.</p>
        <h2 className="section-title">City marks</h2>
        <p>The small line drawings of each city were drawn for Daypass. They are not official city logos.</p>
      </main>
    </Page>
  );
}
