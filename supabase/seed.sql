-- =========================================================
-- VCA PHILIPPINES CMS DEMO
-- STEP 4 - CANONICAL SEED DATA
-- =========================================================


insert into public.homepage_content (
  id,
  site_logo_url,
  theme_primary_color,
  theme_secondary_color,
  theme_background_color,
  theme_text_color,
  theme_heading_font,
  theme_body_font,
  hero_eyebrow,
  hero_title,
  hero_description,
  hero_image_url,
  hero_button_text,
  hero_button_link,
  about_label,
  about_title,
  about_description,
  about_image_url,
  footer_text
) values (
  1,
  'assets/vca_phils_logo.png',
  '#233B82',
  '#98C2EC',
  '#FFFFFF',
  '#1F2937',
  'system-default',
  'system-default',
  'Victory Churches of Asia',
  'VCA Philippines',
  'Growing churches. Equipping leaders. Reaching communities with the Gospel of Jesus Christ.',
  'assets/hero-default.webp',
  'Learn More',
  '#about',
  'Our Movement',
  'One Church. Many Communities.',
  'Victory Churches of Asia Philippines is a family of local churches committed to making disciples, developing leaders, planting churches, and serving communities across the nation.',
  'assets/movement.webp',
  '© 2026 Victory Churches of Asia Philippines'
);


insert into public.homepage_announcements (
  homepage_id,
  announcement_date,
  announcement_title,
  announcement_description,
  sort_order
) values (
  1,
  'September 2026',
  'Welcome to the VCA Philippines Website Demo',
  'This page is being used to demonstrate how website content may eventually be managed through a custom-built CMS.',
  1
);
