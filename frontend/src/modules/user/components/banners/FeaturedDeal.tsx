import DealRowsSection from './DealRowsSection';

export default function FeaturedDeal() {
  return (
    <DealRowsSection
      title="Featured Deals"
      subtitle="See the latest deals and exciting new offers!"
      viewAllPath="/featured-deals"
      badge="Featured"
      idsKey="featuredDealProductIds"
      legacyIdKey="featuredDealProductId"
    />
  );
}
