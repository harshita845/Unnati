import BannerSlider from './BannerSlider';
import DealRowsSection from './DealRowsSection';

export default function DealOfTheDay() {
  return (
    <DealRowsSection
      title="Deal of the Day"
      subtitle="Grab the best prices before they reset!"
      viewAllPath="/deal-of-the-day"
      badge="Active Deal"
      idsKey="dealOfTheDayProductIds"
      legacyIdKey="dealOfTheDayProductId"
      topSlot={<BannerSlider position="Deal of the Day" />}
    />
  );
}
