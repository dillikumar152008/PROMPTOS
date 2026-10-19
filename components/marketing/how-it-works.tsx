import React from 'react';
import { ArrowRight } from 'lucide-react';

export const MarketingHowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Describe',
      description: 'Enter your logic, desired schema, and end-user placeholders in plain English. No model fine-tuning or backend boilerplate needed.',
      href: '/signup?role=creator&from=how-describe',
    },
    {
      num: '02',
      title: 'Deploy',
      description: 'Generate a protected endpoint in a single click with automated rate limits and character validation.',
      href: '/signup?role=creator&from=how-deploy',
    },
    {
      num: '03',
      title: 'Share',
      description: 'Distribute your unique tool URL to users or coworkers. Monitor real-time execution analytics across your portfolio.',
      href: '/signup?role=creator&from=how-share',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-20 border-b border-zinc-800 bg-[#09090b]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            From Plain English to Live App in 3 Steps
          </h2>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            A linear progression designed for high engineering velocity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {steps.map((step) => (
            <a
              key={step.num}
              href={step.href}
              className="p-5 rounded-md border border-zinc-800 bg-[#09090b] hover:bg-[#121215] hover:border-zinc-700 transition-colors duration-150 ease-out flex flex-col justify-between group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <div>
                <span className="text-xl font-mono font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors duration-150 ease-out">
                  {step.num}
                </span>
                <h3 className="font-sans text-base font-semibold text-white mt-2 group-hover:text-zinc-100 transition-colors duration-150 ease-out">
                  {step.title}
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed mt-2 font-normal">
                  {step.description}
                </p>
              </div>

              <div className="mt-6 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors duration-150 ease-out">
                <span>Start step {step.num}</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </a>
          ))}
        </div>

      </div>
    </section>
  );
};
