// from base-app/src/components/ui/rating-display.tsx — ported verbatim; only import paths rewired.
import { FC } from 'react';
import { IconRenderer } from './icon-renderer';

interface Props {
  rating?: number;
}

const RatingDisplay: FC<Props> = ({ rating = 3.5 }) => {
  const highestValue = 5;

  return (
    <div className="flex space-x-[3px] mb-1 md:mb-0 md:space-x-1.5">
      {Array.from({
        length: parseInt((rating >= highestValue ? highestValue : rating) + ''),
      })?.map((_: any, id: number) => <IconRenderer icon="Star" key={`star-fill-icon-${id}`} className="fill-amber-300" />)}
      {!!(rating < highestValue && parseFloat(String(rating)).toString().split('.')[1]) && <IconRenderer icon="StarHalf" />}
      {Array.from({
        length:
          highestValue -
          (parseInt((rating >= highestValue ? highestValue : rating) + '') +
            Number(
              !!parseFloat(rating + '')
                .toString()
                .split('.')[1],
            )),
      })?.map((_: any, id: number) => <IconRenderer icon="Star" key={`star-fill-icon-${id}`} />)}
    </div>
  );
};

export default RatingDisplay;
