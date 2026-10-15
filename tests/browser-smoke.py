import base64
import struct
import threading
import unittest
import zlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def png_with_five_bands():
    width, height = 100, 50
    colors = [(220, 35, 45, 255), (30, 170, 80, 255), (40, 90, 210, 255), (230, 195, 35, 255), (135, 55, 170, 255)]
    raw = bytearray()
    for _ in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(colors[min(x // 20, 4)])

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(bytes(raw))) + chunk(b'IEND', b'')


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class PalettePostcardsBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), lambda *args, **kwargs: QuietHandler(*args, directory=str(ROOT), **kwargs))
        cls.origin = f'http://127.0.0.1:{cls.server.server_port}'
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.temp = TemporaryDirectory()
        cls.image_path = Path(cls.temp.name) / 'five-colors.png'
        cls.image_path.write_bytes(png_with_five_bands())
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium')

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def setUp(self):
        self.context = self.browser.new_context(accept_downloads=True)
        self.context.grant_permissions(['clipboard-read', 'clipboard-write'], origin=self.origin)
        self.page = self.context.new_page()
        self.page.set_default_timeout(2500)
        self.requests = []
        self.page.on('request', lambda request: self.requests.append(request.url))
        self.page.goto(self.origin)

    def tearDown(self):
        self.context.close()

    def test_photo_updates_card_title_reorder_copy_and_png_export(self):
        self.page.locator('#photo-input').set_input_files(str(self.image_path))
        self.page.wait_for_function("document.querySelectorAll('#palette-list li.palette-swatch').length === 5")
        self.assertTrue(self.page.locator('#photo-preview').is_visible())
        before = self.page.locator('#palette-list .color-hex').all_text_contents()
        self.page.get_by_role('textbox', name='Card title').fill('A bright morning')
        self.assertEqual(self.page.locator('#card-title-preview').inner_text(), 'A bright morning')
        move_down = self.page.get_by_role('button', name='Move color 1 down')
        move_down.focus()
        move_down.press('Enter')
        after = self.page.locator('#palette-list .color-hex').all_text_contents()
        self.assertNotEqual(before, after)
        self.assertEqual(self.page.evaluate('document.activeElement.getAttribute("aria-label")'), 'Move color 2 up')
        self.assertNotEqual(self.page.evaluate('getComputedStyle(document.activeElement).boxShadow'), 'none')
        self.page.get_by_role('button', name='Copy colors').click()
        copied = self.page.evaluate('navigator.clipboard.readText()')
        self.assertEqual(copied.splitlines(), [value.strip().upper() for value in after])
        with self.page.expect_download() as download_info:
            self.page.get_by_role('button', name='Download card').click()
        download = download_info.value
        self.assertEqual(download.suggested_filename, 'palette-postcard.png')
        output = Path(download.path()).read_bytes()
        self.assertEqual(output[:8], b'\x89PNG\r\n\x1a\n')
        self.assertEqual(struct.unpack('>II', output[16:24]), (1200, 1500))
        encoded = base64.b64encode(output).decode('ascii')
        first_exported_swatch = self.page.evaluate('''async (encoded) => {
          const response=await fetch(`data:image/png;base64,${encoded}`);
          const bitmap=await createImageBitmap(await response.blob());
          const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1500;
          const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);
          const pixel=[...context.getImageData(80,1160,1,1).data];bitmap.close?.();return pixel;
        }''', encoded)
        self.assertTrue(all(abs(actual - expected) <= 2 for actual, expected in zip(first_exported_swatch[:3], [135, 55, 170])), first_exported_swatch)
        self.assertTrue(all(url.startswith(self.origin) or url.startswith(f'blob:{self.origin}/') for url in self.requests), self.requests)

    def test_png_export_reuses_the_number_shown_in_the_preview(self):
        self.page.add_init_script('Math.random = () => 0.5')
        self.page.reload()
        number = self.page.locator('#card-number-preview').inner_text()
        self.assertEqual(number, '#550')
        self.page.locator('#photo-input').set_input_files(str(self.image_path))
        self.page.wait_for_function("document.querySelectorAll('#palette-list li.palette-swatch').length === 5")
        self.page.evaluate('''() => {
          Math.random = () => 0.9;
          window.__drawnText = [];
          const original = CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
            window.__drawnText.push(String(text));
            return original.call(this, text, ...args);
          };
        }''')
        with self.page.expect_download(timeout=10000):
            self.page.get_by_role('button', name='Download card').click()
        drawn_text = self.page.evaluate('window.__drawnText')
        self.assertIn(number, drawn_text)

    def test_invalid_file_and_oversize_file_show_recovery_messages(self):
        self.page.locator('#photo-input').set_input_files({'name': 'bad.gif', 'mimeType': 'image/gif', 'buffer': b'GIF89a'})
        self.assertIn('JPG, PNG, or WebP', self.page.locator('#status-message').inner_text())
        self.page.evaluate('''() => {
          const file = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'large.png', {type:'image/png'});
          const data = new DataTransfer(); data.items.add(file);
          document.querySelector('.upload-target').dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:data}));
        }''')
        self.assertIn('15 MB', self.page.locator('#status-message').inner_text())
        self.assertTrue(self.page.locator('#page-title').is_visible())

    def test_corrupt_image_bytes_show_a_recovery_message(self):
        self.page.locator('#photo-input').set_input_files({'name': 'broken.png', 'mimeType': 'image/png', 'buffer': b'not a real PNG image'})
        self.page.wait_for_function("document.querySelector('#status-message').textContent.toLowerCase().includes('could not be opened')", timeout=10000)
        self.assertIn('could not be opened', self.page.locator('#status-message').inner_text().lower())
        self.assertTrue(self.page.locator('#page-title').is_visible())

    def test_copy_fallback_explains_that_visible_values_can_be_selected(self):
        self.page.evaluate('''() => {
          Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true});
          document.execCommand = () => false;
        }''')
        self.page.locator('#photo-input').set_input_files(str(self.image_path))
        self.page.wait_for_function("document.querySelectorAll('#palette-list li.palette-swatch').length === 5")
        self.page.get_by_role('button', name='Copy colors').click()
        self.assertIn('Select the visible HEX values', self.page.locator('#status-message').inner_text())

    def test_invalid_new_selection_cancels_a_pending_image_load(self):
        self.page.evaluate('''() => {
          const original = window.createImageBitmap.bind(window);
          window.createImageBitmap = (...args) => new Promise((resolve, reject) => {
            setTimeout(() => original(...args).then(resolve, reject), 250);
          });
        }''')
        self.page.locator('#photo-input').set_input_files(str(self.image_path))
        self.page.locator('#photo-input').set_input_files({'name': 'new.gif', 'mimeType': 'image/gif', 'buffer': b'GIF89a'})
        self.page.wait_for_timeout(400)
        self.assertEqual(self.page.locator('#palette-list li.palette-swatch').count(), 0)
        self.assertIn('JPG, PNG, or WebP', self.page.locator('#status-message').inner_text())

    def test_transparent_pixels_are_ignored_during_real_canvas_sampling(self):
        result = self.page.evaluate('''async () => {
          const {loadLocalImage,sampleImage}=await import('/src/image.js');
          const {extractPalette}=await import('/src/palette.js');
          const canvas=document.createElement('canvas');canvas.width=2;canvas.height=1;
          const context=canvas.getContext('2d');
          const imageData=context.createImageData(2,1);
          imageData.data.set([240,10,10,0,25,80,210,255]);
          context.putImageData(imageData,0,0);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          const loaded=await loadLocalImage(new File([blob],'transparent.png',{type:'image/png'}));
          const sampled=sampleImage(loaded.bitmap,64);
          const palette=extractPalette(sampled.data,sampled.width,sampled.height);
          loaded.bitmap.close?.();
          return {palette,alpha:sampled.data[3]};
        }''')
        self.assertEqual(result['palette'][0], '#1950d2')
        self.assertEqual(result['alpha'], 0)

    def test_low_color_photo_still_produces_five_distinct_swatches(self):
        self.page.evaluate('''async () => {
          const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;
          const context=canvas.getContext('2d');context.fillStyle='#4b7662';context.fillRect(0,0,8,8);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          const data=new DataTransfer();data.items.add(new File([blob],'low-color.png',{type:'image/png'}));
          document.querySelector('.upload-target').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));
        }''')
        self.page.wait_for_function("document.querySelectorAll('#palette-list li.palette-swatch').length === 5")
        colors = self.page.locator('#palette-list .color-hex').all_text_contents()
        self.assertEqual(len(set(colors)), 5)
        self.assertIn('#4B7662', colors)

    def test_transparent_png_does_not_contribute_hidden_rgb_to_page_palette(self):
        self.page.evaluate('''async () => {
          const canvas=document.createElement('canvas');canvas.width=2;canvas.height=1;
          const context=canvas.getContext('2d');const data=context.createImageData(2,1);
          data.data.set([240,10,10,0,25,80,210,255]);context.putImageData(data,0,0);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          const files=new DataTransfer();files.items.add(new File([blob],'transparent.png',{type:'image/png'}));
          document.querySelector('.upload-target').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:files}));
        }''')
        self.page.wait_for_function("document.querySelectorAll('#palette-list li.palette-swatch').length === 5")
        colors = self.page.locator('#palette-list .color-hex').all_text_contents()
        self.assertIn('#1950D2', colors)
        self.assertFalse(any(color.startswith('#F0') for color in colors), colors)

    def test_dropping_a_supported_photo_creates_the_postcard(self):
        encoded = base64.b64encode(png_with_five_bands()).decode('ascii')
        result = self.page.evaluate('''(encoded) => {
          const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
          const file = new File([bytes], 'dropped.png', {type:'image/png'});
          const data = new DataTransfer(); data.items.add(file);
          const target = document.querySelector('.upload-target');
          target.dispatchEvent(new DragEvent('dragenter', {bubbles:true,cancelable:true,dataTransfer:data}));
          const highlighted = target.classList.contains('is-dragging');
          target.dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:data}));
          return {highlighted};
        }''', encoded)
        self.page.wait_for_function("document.querySelectorAll('#palette-list li.palette-swatch').length === 5")
        self.assertTrue(result['highlighted'])
        self.assertTrue(self.page.locator('#photo-preview').is_visible())

    def test_skip_link_moves_keyboard_focus_to_the_maker(self):
        self.page.keyboard.press('Tab')
        self.assertEqual(self.page.evaluate('document.activeElement.className'), 'skip-link')
        self.page.keyboard.press('Enter')
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'maker')

    def test_card_number_is_a_stable_random_three_digit_tag(self):
        self.page.add_init_script('Math.random = () => 0.5')
        self.page.reload()
        number = self.page.locator('#card-number-preview').inner_text()
        self.assertEqual(number, '#550')
        self.page.get_by_role('textbox', name='Card title').fill('Different moment')
        self.assertEqual(self.page.locator('#card-number-preview').inner_text(), number)

    def test_mobile_preview_wraps_an_unbroken_max_length_title(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.get_by_role('textbox', name='Card title').fill('X' * 48)
        dimensions = self.page.locator('#card-title-preview').evaluate('(element) => ({scrollWidth: element.scrollWidth, clientWidth: element.clientWidth})')
        self.assertLessEqual(dimensions['scrollWidth'], dimensions['clientWidth'] + 1, dimensions)

    def test_canvas_renderer_draws_the_source_palette_in_the_4_by_5_frame(self):
        encoded = base64.b64encode(png_with_five_bands()).decode('ascii')
        result = self.page.evaluate('''async (encoded) => {
          const { drawCard } = await import('/src/card.js');
          const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes],{type:'image/png'}));
          const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1500;
          const context = canvas.getContext('2d');
          drawCard(context, { bitmap, title: 'Color test', colors: ['#dc232d','#1eaa50','#285ad2','#e6c323','#8737aa'] });
          const pixel = [...context.getImageData(80, 1160, 1, 1).data];
          const rightPhotoPixel = [...context.getImageData(1000, 450, 1, 1).data];
          bitmap.close?.();
          return { width: canvas.width, height: canvas.height, firstSwatchPixel: pixel, rightPhotoPixel };
        }''', encoded)
        self.assertEqual((result['width'], result['height']), (1200, 1500))
        self.assertEqual(result['firstSwatchPixel'][:3], [220, 35, 45])
        self.assertEqual(result['rightPhotoPixel'][:3], [135, 55, 170])

    def test_export_has_no_color_study_footer_or_sparkle(self):
        result = self.page.evaluate('''async () => {
          const {drawCard}=await import('/src/card.js');
          const image=document.createElement('canvas');image.width=10;image.height=10;
          const bitmap=await createImageBitmap(image);
          const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1500;
          const context=canvas.getContext('2d');const labels=[];
          const wrapped=new Proxy(context,{
            get(target,key){if(key==='fillText')return(text,...args)=>{labels.push(text);return target.fillText(text,...args)};const value=target[key];return typeof value==='function'?value.bind(target):value},
            set(target,key,value){target[key]=value;return true}
          });
          drawCard(wrapped,{bitmap,title:'A little color story',colors:['#dc232d','#1eaa50','#285ad2','#e6c323','#8737aa'],cardNumber:'#742'});
          bitmap.close?.();return labels;
        }''')
        self.assertIn('#742', result)
        self.assertNotIn('COLOR STUDY', result)
        self.assertNotIn('MADE FROM A MOMENT', result)
        self.assertNotIn('✳', result)

    def test_random_number_tag_uses_the_readable_ink_color(self):
        result = self.page.evaluate('''async () => {
          const {drawCard}=await import('/src/card.js');
          const image=document.createElement('canvas');image.width=10;image.height=10;
          const bitmap=await createImageBitmap(image);
          const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1500;
          const context=canvas.getContext('2d');const textColors=[];
          const wrapped=new Proxy(context,{
            get(target,key){if(key==='fillText')return(text,...args)=>{textColors.push([text,target.fillStyle]);return target.fillText(text,...args)};const value=target[key];return typeof value==='function'?value.bind(target):value},
            set(target,key,value){target[key]=value;return true}
          });
          drawCard(wrapped,{bitmap,title:'A little color story',colors:['#dc232d','#1eaa50','#285ad2','#e6c323','#8737aa'],cardNumber:'#742'});
          const rendered=textColors.find(([text])=>text==='#742')?.[1];
          const preview=getComputedStyle(document.querySelector('#card-number-preview')).color;
          bitmap.close?.();return {rendered,preview};
        }''')
        self.assertEqual(result['rendered'], '#172b3a')
        self.assertEqual(result['preview'], 'rgb(23, 43, 58)')

    def test_long_unbroken_title_stays_inside_the_card(self):
        result = self.page.evaluate('''async () => {
          const {drawCard}=await import('/src/card.js');
          const image=document.createElement('canvas');image.width=10;image.height=10;
          const bitmap=await createImageBitmap(image);
          const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1500;
          const context=canvas.getContext('2d');const texts=[];
          const wrapped=new Proxy(context,{
            get(target,key){if(key==='fillText')return(text,...args)=>{texts.push({text,width:target.measureText(text).width});return target.fillText(text,...args)};const value=target[key];return typeof value==='function'?value.bind(target):value},
            set(target,key,value){target[key]=value;return true}
          });
          const title='X'.repeat(48);
          drawCard(wrapped,{bitmap,title,colors:['#dc232d','#1eaa50','#285ad2','#e6c323','#8737aa']});
          const titleLines=texts.filter(entry=>entry.text.includes('X'));
          bitmap.close?.();
          return {titleLines};
        }''')
        self.assertLessEqual(len(result['titleLines']), 2)
        self.assertTrue(all(entry['width'] <= 1072 for entry in result['titleLines']), result)


if __name__ == '__main__':
    unittest.main()
