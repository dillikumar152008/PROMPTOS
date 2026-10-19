import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

export const MarketingPricing: React.FC = () => {
  const tiers = [
    {
      name: 'Starter',
      price: '$0',
      period: 'free',
      badge: null,
      description: 'For prompt creators deploying their first single-purpose tools.',
      features: [
        'Up to 3 active mini-apps',
        '1,000 monthly executions',
        'Standard model execution',
        'Shareable /app/:slug URLs',
        'Usage analytics & run logging',
      ],
      ctaText: 'Start free',
      href: '/signup?role=creator&from=pricing-starter',
      featured: false,
    },
    {
      name: 'Pro',
      price: '$29',
      period: 'per month',
      badge: 'Coming soon',
      description: 'For creators scaling high-frequency AI micro-tools with advanced analytics.',
      features: [
        'Unlimited deployed mini-apps',
        '50,000 monthly executions',
        'Custom vanity slugs',
        'Priority execution queue',
        'Granular token & latency graphs',
      ],
      ctaText: 'Join waitlist',
      href: '/signup?role=creator&from=pricing-pro',
      featured: true,
    },
    {
      name: 'Team',
      price: '$99',
      period: 'per month',
      badge: 'Coming soon',
      description: 'For teams sharing internal prompt workflows across member accounts.',
      features: [
        'Centralized team workspace',
        'Shared organization apps',
        'Role-based member invitations',
        'Unified usage accounting',
        'Audit log export',
      ],
      ctaText: 'Join waitlist',
      href: '/signup?role=creator&from=pricing-team',
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="py-16 md:py-20 border-b border-zinc-800 bg-[#09090b]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            Get started for free. Paid plans are currently in preview.
          </p>
        </div>

        {/* 3 Plain Tiers with 1px borders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              className={`rounded-md p-6 border flex flex-col justify-between bg-[#09090b] ${
                tier.featured
                  ? 'border-zinc-700'
                  : 'border-zinc-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-sans font-semibold text-base text-white">
                    {tier.name}
                  </h3>
                  {tier.badge && (
                    <Badge variant="warning">{tier.badge}</Badge>
                  )}
                </div>

                <div className="flex items-baseline space-x-1.5 mb-3">
                  <span className="text-3xl font-bold font-mono text-white tabular-nums">
                    {tier.price}
                  </span>
                  <span className="text-xs text-zinc-400">/{tier.period}</span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed mb-6">
                  {tier.description}
                </p>

                <div className="space-y-2.5 pt-4 border-t border-zinc-800 mb-6">
                  {tier.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start space-x-2 text-xs text-zinc-300">
                      <Check className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <a href={tier.href} className="w-full block" tabIndex={-1}>
                  <Button
                    variant={tier.featured ? 'solid' : 'secondary'}
                    size="md"
                    className="w-full"
                  >
                    {tier.ctaText}
                  </Button>
                </a>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
